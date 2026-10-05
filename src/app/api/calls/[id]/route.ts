import { z } from "zod";
import type { ClientSession } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Booking, Consultation, HealthQuiz, User } from "@/lib/models";
import { getSession, type SessionPayload } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { notify } from "@/lib/notify";
import { MAX_NO_ANSWER, callProblem, callWhen, callsOverlap, earliestDrip } from "@/lib/clinical/calls";
import { ownClashMessage, slotProblem } from "@/lib/clinical/slots";
import { slotContext } from "@/lib/clinical/slot-availability";
import { bookedCalls, ensureCallIndexes, hoursOf, unansweredSince } from "@/lib/data/calls";
import { ok, fail, handleError } from "@/lib/api";
import { syncBookingMoney } from "@/lib/payments/money";
import { withScheduleLock, type Refusal } from "@/lib/booking/schedule-lock";
import { saveUnlessChanged } from "@/lib/db/guarded";
import { getClockFormat } from "@/lib/settings/clock";
import { clockText } from "@/lib/time";
import { patientClash } from "@/lib/data/own-sessions";

export const dynamic = "force-dynamic";

const Action = z.discriminatedUnion("action", [
  /** A new time. `dripAt` moves the held drip in the same request, when the new call would come too close to it. */
  z.object({ action: z.literal("move"), startAt: z.string().datetime(), dripAt: z.string().datetime().optional() }),
  z.object({ action: z.literal("cancel"), reason: z.string().max(300).optional() }),
  z.object({ action: z.literal("done"), note: z.string().max(1000).optional() }),
  z.object({ action: z.literal("no_answer"), note: z.string().max(1000).optional() }),
  z.object({ action: z.literal("handover"), doctorId: z.string().max(40) }),
]);

type CallDoc = {
  _id: unknown;
  callNo: string;
  patientId: unknown;
  doctorId: unknown;
  startAt: Date;
  minutes: number;
  status: string;
  movedFrom?: Date[];
  save: () => Promise<unknown>;
  [k: string]: unknown;
};

/** Who is this to the call? */
function relation(session: SessionPayload, call: CallDoc) {
  return {
    patient: session.role === "patient" && String(call.patientId) === session.sub,
    doctor: session.role === "doctor" && String(call.doctorId) === session.sub,
    admin: can(session.role, "calls.manage"),
  };
}

/** The patient's drip held for the physician's approval, the next one. */
function heldDrip(patientId: unknown) {
  return Booking.findOne({ patientId, status: "awaiting_review", scheduledAt: { $gte: new Date() } }).sort({
    scheduledAt: 1,
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const clockFmt = await getClockFormat();
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);
    const { id } = await params;
    const input = Action.parse(await req.json());
    await connectDB();

    await ensureCallIndexes();
    const call = (await Consultation.findById(id)) as CallDoc | null;
    if (!call) return fail("That call does not exist", 404);
    const who = relation(session, call);
    if (call.status !== "booked") return fail("That call is no longer booked", 409);

    const [patient, doctor] = await Promise.all([
      User.findById(call.patientId).select("name").lean<{ name: string } | null>(),
      User.findById(call.doctorId).select("name").lean<{ name: string } | null>(),
    ]);
    const patientName = patient?.name ?? "The patient";
    const doctorName = doctor?.name ?? "The physician";
    const audit = (action: string, before: object, after: object) =>
      AuditLog.create({
        actorId: session.sub,
        actorRole: session.role,
        action: `call.${action}`,
        entity: "Consultation",
        entityId: id,
        before,
        after: { callNo: call.callNo, ...after },
      });

    /* ---------------- move ---------------- */
    if (input.action === "move") {
      if (!who.patient && !who.doctor && !who.admin) return fail("Not permitted", 403);
      const hours = await hoursOf(String(call.doctorId));
      if (!hours) return fail("That physician has no call hours set", 409);
      const at = new Date(input.startAt);
      const booked = await bookedCalls(
        String(call.doctorId),
        new Date(at.getTime() - 86_400_000),
        new Date(at.getTime() + 86_400_000),
        id
      );
      const problem = callProblem(hours, booked, at);
      if (problem) return fail(clockText(problem.error, clockFmt), problem.status);

      // The held drip must stay 2 hours after the call. A later call takes the
      // drip with it, in the same request, or not at all.
      const drip = await heldDrip(call.patientId);
      const needFrom = earliestDrip(at.getTime(), hours.callMinutes);
      let dripMove: { from: Date; to: Date } | null = null;
      if (drip && drip.scheduledAt.getTime() < needFrom) {
        if (!input.dripAt) {
          return fail(
            `Your held drip on ${callWhen(drip.scheduledAt, clockFmt)} would be less than 2 hours after this call. Pick a new drip time too.`,
            409,
            { needsDripMove: true, bookingId: String(drip._id), earliestDrip: new Date(needFrom).toISOString() }
          );
        }
        const dripAt = new Date(input.dripAt);
        if (dripAt.getTime() < needFrom) {
          return fail(`Pick a drip time from ${callWhen(new Date(needFrom), clockFmt)}, 2 hours after the call.`, 422);
        }
        dripMove = { from: drip.scheduledAt, to: dripAt };
      }

      const before = call.startAt;
      const moveCall = (tx?: ClientSession) =>
        Consultation.updateOne(
          { _id: id, status: "booked" },
          { $set: { startAt: at, minutes: hours.callMinutes }, $push: { movedFrom: before } },
          tx ? { session: tx } : {}
        );
      try {
        if (!drip || !dripMove) {
          await moveCall();
        } else {
          // The call and the drip move together or not at all, and the drip's
          // new time is checked and taken in one step no booking, move or
          // approval can interleave with (see schedule-lock).
          const to = dripMove.to;
          const refused = await withScheduleLock(async (tx) => {
            const d = await Booking.findById(drip._id).session(tx);
            if (!d || d.status !== "awaiting_review") {
              return {
                error: "Your held drip changed a moment ago. Reload and try again.",
                status: 409,
              } satisfies Refusal;
            }
            const clash = await patientClash(String(call.patientId), to, d.durationMin ?? 45, String(d._id));
            if (clash) return { error: ownClashMessage(clash, clockFmt), status: 409 } satisfies Refusal;
            const slot = slotProblem(
              await slotContext({ pincode: d.pincode, from: to, to, excludeBookingId: String(d._id) }),
              to,
              d.durationMin ?? 45
            );
            if (slot) return { error: clockText(slot.error, clockFmt), status: slot.status } satisfies Refusal;
            await moveCall(tx);
            d.rescheduledFrom = d.scheduledAt;
            d.scheduledAt = to;
            await d.save();
            return null;
          });
          if (refused) return fail(refused.error, refused.status);
        }
      } catch (err) {
        if ((err as { code?: number }).code === 11000) return fail("That call time was just taken. Pick another.", 409);
        throw err;
      }

      const line = `Now ${callWhen(at, clockFmt)} (was ${callWhen(before, clockFmt)}).${dripMove ? ` The held drip ${drip!.bookingNo} moved to ${callWhen(dripMove.to, clockFmt)}.` : ""}`;
      if (!who.doctor)
        await notify(
          String(call.doctorId),
          `Call moved · ${call.callNo}`,
          `${patientName}. ${line}`,
          "info",
          "/doctor/calls"
        );
      if (!who.patient)
        await notify(
          String(call.patientId),
          `Your call was moved · ${call.callNo}`,
          `${doctorName}. ${line}`,
          "info",
          "/app"
        );
      await audit("move", { startAt: before }, { startAt: at, ...(dripMove ? { dripMovedTo: dripMove.to } : {}) });
      return ok({ startAt: at.toISOString(), dripMovedTo: dripMove?.to.toISOString() ?? null });
    }

    /* ---------------- cancel ---------------- */
    if (input.action === "cancel") {
      if (!who.patient && !who.doctor && !who.admin) return fail("Not permitted", 403);
      await Consultation.updateOne(
        { _id: id, status: "booked" },
        {
          $set: {
            status: "cancelled",
            cancelledAt: new Date(),
            cancelledBy: session.sub,
            cancelReason: input.reason?.trim() || undefined,
          },
        }
      );
      // The held drip stays: it is confirmed once the patient books a new call and the physician approves.
      if (!who.doctor)
        await notify(
          String(call.doctorId),
          `Call cancelled · ${call.callNo}`,
          `${patientName}, ${callWhen(call.startAt, clockFmt)}.`,
          "info",
          "/doctor/calls"
        );
      if (!who.patient) {
        await notify(
          String(call.patientId),
          `Your call was cancelled · ${call.callNo}`,
          `${doctorName}, ${callWhen(call.startAt, clockFmt)}. Book a new time on Home — your held drip waits for it.`,
          "warning",
          "/app"
        );
      }
      await audit("cancel", { status: "booked" }, { status: "cancelled", reason: input.reason ?? null });
      return ok({ status: "cancelled" });
    }

    /* ---------------- called / no answer ---------------- */
    if (input.action === "done" || input.action === "no_answer") {
      if (!who.doctor && !(who.admin && can(session.role, "calls.work")))
        return fail("Only the physician on the call marks it", 403);
      // Not before the call is due: a "no answer" at 9 for a 10:30 call is a slip.
      if (Date.now() < call.startAt.getTime() - 15 * 60_000) {
        return fail(`This call is at ${callWhen(call.startAt, clockFmt)}. Mark it once you have called.`, 409);
      }
      await Consultation.updateOne(
        { _id: id, status: "booked" },
        {
          $set: {
            status: input.action,
            outcomeAt: new Date(),
            outcomeBy: session.sub,
            outcomeNote: input.note?.trim() || undefined,
          },
        }
      );

      const calledOff: string[] = [];
      if (input.action === "no_answer") {
        const quiz = await HealthQuiz.findOne({ patientId: call.patientId })
          .sort({ completedAt: -1 })
          .select("completedAt")
          .lean<{ completedAt: Date } | null>();
        const misses = await unansweredSince(String(call.patientId), quiz?.completedAt ?? new Date(0));
        if (misses >= MAX_NO_ANSWER) {
          // Twice unreachable: the held drip is released rather than kept for a patient who may not come.
          const held = await Booking.find({ patientId: call.patientId, status: "awaiting_review" });
          for (const b of held) {
            b.status = "cancelled";
            b.cancelledAt = new Date();
            b.cancelReason = `${MAX_NO_ANSWER} calls from the physician went unanswered.`;
            b.cancelledByRole = "system";
            // Approved or cancelled a moment ago: leave it as it now is.
            if (!(await saveUnlessChanged(b))) continue;
            calledOff.push(b.bookingNo);
            // What they paid to hold it goes back.
            await syncBookingMoney(String(b._id)).catch((err) => console.error("[calls] refund:", err));
          }
        }
        await notify(
          String(call.patientId),
          "We could not reach you",
          `${doctorName} called at ${callWhen(call.startAt, clockFmt)}. ${
            calledOff.length
              ? `After ${MAX_NO_ANSWER} missed calls your held session ${calledOff.join(", ")} was released. Book a new call when you are free.`
              : "Pick a new time on Home — your held drip waits for it."
          }`,
          "warning",
          "/app"
        );
      }
      await audit(
        input.action,
        { status: "booked" },
        { status: input.action, note: input.note ?? null, ...(calledOff.length ? { heldReleased: calledOff } : {}) }
      );
      return ok({ status: input.action, heldReleased: calledOff });
    }

    /* ---------------- hand over ---------------- */
    if (!who.admin) return fail("Only the super admin hands a call to another physician", 403);
    if (input.doctorId === String(call.doctorId)) return fail("That is already this call's physician", 422);
    const next = await User.findOne({ _id: input.doctorId, role: "doctor", status: "active" })
      .select("name")
      .lean<{ name: string } | null>();
    if (!next) return fail("That physician is not active", 422);
    const theirs = await bookedCalls(
      input.doctorId,
      new Date(call.startAt.getTime() - 3_600_000),
      new Date(call.startAt.getTime() + 3_600_000)
    );
    if (theirs.some((b) => callsOverlap(call.startAt.getTime(), call.minutes, b.start, b.minutes))) {
      return fail(
        `${next.name} already has a call at ${callWhen(call.startAt, clockFmt)}. Move this call first, or choose someone else.`,
        409
      );
    }
    try {
      await Consultation.updateOne(
        { _id: id, status: "booked" },
        { $set: { doctorId: input.doctorId, handedOverFrom: call.doctorId } }
      );
    } catch (err) {
      if ((err as { code?: number }).code === 11000) return fail(`${next.name} already has a call at that time.`, 409);
      throw err;
    }
    const when = callWhen(call.startAt, clockFmt);
    await notify(
      input.doctorId,
      `Call handed to you · ${call.callNo}`,
      `${patientName}, ${when}. Their answers are in your queue.`,
      "info",
      "/doctor/calls"
    );
    await notify(
      String(call.doctorId),
      `Call handed over · ${call.callNo}`,
      `${patientName}, ${when}, now with ${next.name}.`,
      "info",
      "/doctor/calls"
    );
    await notify(
      String(call.patientId),
      `Your call is now with ${next.name}`,
      `Same time: ${when}. ${doctorName} is not available.`,
      "info",
      "/app"
    );
    await audit("handover", { doctor: doctorName }, { doctor: next.name });
    return ok({ doctorId: input.doctorId });
  } catch (err) {
    return handleError(err);
  }
}
