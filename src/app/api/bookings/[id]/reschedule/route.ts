import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Booking, HealthQuiz, User } from "@/lib/models";
import { approvalState } from "@/lib/clinical/validity";
import { getSession } from "@/lib/auth/session";
import { canManageBooking } from "@/lib/auth/ownership";
import { notify, notifyRole } from "@/lib/notify";
import { MIN_LEAD_MS, busyNurses, slotProblem } from "@/lib/clinical/slots";
import { slotContext } from "@/lib/clinical/slot-availability";
import { pickNurse } from "@/lib/clinical/assign";
import { getLatePolicy } from "@/lib/billing/settings";
import { inr, lateFee } from "@/lib/billing/late-policy";
import { ok, fail, handleError } from "@/lib/api";

const Input = z.object({
  scheduledAt: z.string().datetime(),
  /** The patient has seen the late fee and agreed to it. Required inside the window. */
  acceptFee: z.boolean().optional(),
});

/**
 * A slot can be moved, but not indefinitely. Past this the session is holding
 * stock and a nurse's route slot without ever happening, and the clinical team
 * should be looking at it rather than the patient shuffling it again.
 */
const MAX_RESCHEDULES = 3;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);

    const { id } = await params;
    const { scheduledAt, acceptFee } = Input.parse(await req.json());
    await connectDB();

    const booking = await Booking.findById(id);
    if (!booking) return fail("Session not found", 404);

    const isOwner = session.role === "patient" && String(booking.patientId) === session.sub;
    if (!canManageBooking(session, booking)) return fail("Not permitted", 403);

    if (["completed", "in_progress", "cancelled", "rejected"].includes(booking.status)) {
      return fail("That session can no longer be moved", 409);
    }

    // Inside the late window a patient may still move the session -- the nurse
    // is already dispatched with the batch drawn, so it costs the late fee, and
    // only once they have seen the amount and agreed to it. Staff moving a
    // session are never charged to the patient. A slot already in the past is
    // the deepest part of the window, not outside it.
    const policy = await getLatePolicy();
    const hoursOut = (booking.scheduledAt.getTime() - Date.now()) / 3_600_000;
    const fee = isOwner ? lateFee(policy, hoursOut, "late_reschedule") : 0;
    if (fee > 0 && !acceptFee) {
      return fail(
        `Your slot is less than ${policy.windowHours} hours away, so moving it now costs ${inr(fee)} — the nurse is already on their way with your batch drawn.`,
        409,
        { fee, windowHours: policy.windowHours }
      );
    }
    // A server started before charges existed would move the session and lose the fee.
    if (fee > 0 && !Booking.schema.path("charges")) {
      return fail("The server is running an older version and would not record the fee. Restart it (stop it and run npm run dev again).", 500);
    }

    const next = new Date(scheduledAt);
    if (next.getTime() - Date.now() < MIN_LEAD_MS) return fail("Pick a slot at least an hour from now", 422);

    // Only a time the zone offers, with a nurse free for it. The session being
    // moved does not count against itself.
    const durationMin = booking.durationMin ?? 45;
    const ctx = await slotContext({ pincode: booking.pincode, from: next, to: next, excludeBookingId: id });
    const slot = slotProblem(ctx, next, durationMin);
    if (slot) return fail(slot.error, slot.status);

    if ((booking.rescheduleCount ?? 0) >= MAX_RESCHEDULES) {
      return fail(
        `This session has already been moved ${MAX_RESCHEDULES} times. Cancel it and book again, or call us and we will sort it out.`,
        409
      );
    }

    // The physician's approval covers the patient as they were when it was
    // given. If it has lapsed, a later slot is a new clinical decision — so it
    // needs a fresh review rather than a drag on the calendar.
    if (isOwner) {
      const quiz = await HealthQuiz.findOne({ patientId: booking.patientId })
        .sort({ completedAt: -1 })
        .lean<{ reviewStatus: string; reviewedAt?: Date; completedAt: Date } | null>();
      const approval = approvalState(quiz);
      if (!approval.canBook && !approval.canHold) {
        return fail(approval.message, 409);
      }
    }

    const previous = booking.scheduledAt;
    const at = (d: Date) =>
      d.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });
    booking.rescheduledFrom = previous;
    booking.scheduledAt = next;
    booking.rescheduleCount = (booking.rescheduleCount ?? 0) + 1;
    if (fee > 0) {
      booking.charges = [
        ...(booking.charges ?? []),
        { kind: "late_reschedule", amount: fee, at: new Date(), byId: session.sub, note: `Moved from ${at(previous)} to ${at(next)}` },
      ];
    }
    // The nurse already on it may be busy at the new time. Then it goes to one
    // who is free — the slot was only offered because somebody was.
    const previousNurseId = booking.nurseId ? String(booking.nurseId) : null;
    let handedTo: { nurseId: string; name: string } | null = null;
    if (previousNurseId && busyNurses(ctx.held, next.getTime(), durationMin).has(previousNurseId)) {
      const patient = await User.findById(booking.patientId)
        .select("patient.latitude patient.longitude")
        .lean<{ patient?: { latitude?: number; longitude?: number } } | null>();
      const pick = await pickNurse(
        { latitude: patient?.patient?.latitude, longitude: patient?.patient?.longitude, pincode: booking.pincode },
        { excludeNurseId: previousNurseId, session: { start: next, durationMin, bookingId: id } }
      );
      if (pick) {
        booking.nurseId = pick.nurseId;
        handedTo = { nurseId: pick.nurseId, name: pick.name };
      } else {
        booking.nurseId = undefined;
      }
      if (["nurse_assigned", "en_route"].includes(booking.status)) booking.status = pick ? "nurse_assigned" : "approved";
    }
    await booking.save();

    const when = at(next);
    if (previousNurseId && String(booking.nurseId ?? "") !== previousNurseId) {
      await notify(
        previousNurseId,
        `Session handed on · ${booking.bookingNo}`,
        `It moved to ${when}, when you already have a session. ${handedTo ? `${handedTo.name} is taking it.` : "The team is finding a nurse."} It is off your route.`,
        "info",
        "/nurse/schedule"
      );
      if (handedTo) {
        await notify(handedTo.nurseId, `New session assigned · ${booking.bookingNo}`, `${booking.dripName ?? "Session"} · ${when}`, "info", "/nurse");
      } else {
        await notifyRole(["admin", "superadmin"], `Session needs a nurse · ${booking.bookingNo}`, `Moved to ${when}; nobody free was found.`, "warning", "/admin");
      }
    }
    await notify(
      booking.nurseId ? String(booking.nurseId) : null,
      fee > 0 ? `Session moved at the last moment · ${booking.bookingNo}` : `Session moved · ${booking.bookingNo}`,
      fee > 0
        ? `Was ${at(previous)}, now ${when}. The patient moved it inside the late window and was charged the late fee. Your route has been updated.`
        : `Now ${when}. Your route has been updated.`,
      "warning",
      "/nurse/schedule"
    );
    if (!isOwner) {
      await notify(String(booking.patientId), `Your session was moved · ${booking.bookingNo}`, `Now ${when}.`, "info", "/app/sessions");
    }

    await AuditLog.create({
      actorId: session.sub,
      actorRole: session.role,
      action: "booking.reschedule",
      entity: "Booking",
      entityId: id,
      before: { scheduledAt: previous },
      after: {
        scheduledAt: next,
        ...(fee > 0 ? { lateFee: fee } : {}),
        ...(previousNurseId && String(booking.nurseId ?? "") !== previousNurseId ? { nurseHandedOn: handedTo?.name ?? "nobody free" } : {}),
      },
    });

    return ok({ scheduledAt: next.toISOString(), rescheduleCount: booking.rescheduleCount, fee });
  } catch (err) {
    return handleError(err);
  }
}
