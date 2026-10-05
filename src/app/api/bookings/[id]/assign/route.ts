import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Booking, User } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { canManageBooking } from "@/lib/auth/ownership";
import { notify } from "@/lib/notify";
import { pickNurse } from "@/lib/clinical/assign";
import { isRefusal, withScheduleLock, type Refusal } from "@/lib/booking/schedule-lock";
import { ok, fail, handleError } from "@/lib/api";
import { BETWEEN_SESSIONS_MIN, HOLDING_STATUSES, clashes, istParts } from "@/lib/clinical/slots";

const Input = z.object({
  /** Omit to let the engine choose the nearest nurse under capacity. */
  nurseId: z.string().optional(),
  reason: z.string().max(300).optional(),
});

/** Reassignment: a doctor, admin or clinic overriding the automatic choice. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    // A patient does not choose their own nurse; dispatch does.
    if (!session || !["superadmin", "admin", "doctor", "clinic"].includes(session.role)) {
      return fail("Not permitted", 403);
    }

    const { id } = await params;
    const { nurseId, reason } = Input.parse(await req.json().catch(() => ({})));
    await connectDB();

    const booking = await Booking.findById(id);
    if (!booking) return fail("Session not found", 404);
    // Scoped, so one clinic cannot reassign another clinic's nurse.
    if (!canManageBooking(session, booking)) return fail("Not permitted", 403);

    if (nurseId) {
      const nurse = await User.findById(nurseId).lean<{ name: string; role: string; status: string } | null>();
      if (!nurse || nurse.role !== "nurse") return fail("That is not a nurse account", 422);
      if (nurse.status !== "active") return fail(`${nurse.name} is not active`, 409);
    }

    // Checked and written in one step no booking, move or approval can
    // interleave with (see schedule-lock), on the session as it is now: two
    // people handing out the same nurse for the same time cannot both succeed.
    const out = await withScheduleLock(async (tx) => {
      const b = await Booking.findById(id).session(tx);
      if (!b) return { error: "Session not found", status: 404 } satisfies Refusal;
      if (["completed", "cancelled", "rejected"].includes(b.status)) {
        return { error: "That session is finished — there is nothing to reassign", status: 409 } satisfies Refusal;
      }
      if (b.status === "in_progress") {
        return {
          error: "The infusion has started. Swapping the nurse mid-session is not safe.",
          status: 409,
        } satisfies Refusal;
      }
      const previous = b.nurseId ? String(b.nurseId) : null;

      if (nurseId) {
        // One nurse, one door at a time: the session plus the travel after it.
        const theirs = await Booking.find({
          _id: { $ne: b._id },
          nurseId,
          status: { $in: HOLDING_STATUSES },
          scheduledAt: {
            $gte: new Date(b.scheduledAt.getTime() - 86_400_000),
            $lte: new Date(b.scheduledAt.getTime() + 86_400_000),
          },
        })
          .select("bookingNo scheduledAt durationMin")
          .lean<Array<{ bookingNo: string; scheduledAt: Date; durationMin?: number }>>();
        const clash = theirs.find((o) =>
          clashes(b.scheduledAt.getTime(), b.durationMin ?? 45, new Date(o.scheduledAt).getTime(), o.durationMin ?? 45)
        );
        if (clash) {
          const nurse = await User.findById(nurseId).select("name").lean<{ name?: string } | null>();
          return {
            error: `${nurse?.name ?? "That nurse"} already has ${clash.bookingNo} at ${istParts(new Date(clash.scheduledAt)).time}, and needs ${BETWEEN_SESSIONS_MIN} minutes to travel on. Choose another nurse, or move one of the sessions.`,
            status: 409,
          } satisfies Refusal;
        }
        b.nurseId = nurseId;
      } else {
        const patient = await User.findById(b.patientId).lean<{
          patient?: { latitude?: number; longitude?: number; pincode?: string };
        } | null>();
        const pick = await pickNurse(
          {
            latitude: patient?.patient?.latitude,
            longitude: patient?.patient?.longitude,
            pincode: patient?.patient?.pincode,
          },
          // Never hand it straight back to the nurse being replaced, nor to anyone busy then.
          {
            excludeNurseId: previous,
            session: {
              start: b.scheduledAt,
              durationMin: b.durationMin ?? 45,
              bookingId: String(b._id),
            },
          }
        );
        if (!pick)
          return { error: "No other nurse is available under capacity right now", status: 409 } satisfies Refusal;
        b.nurseId = pick.nurseId;
      }

      if (b.status === "approved") b.status = "nurse_assigned";
      await b.save();
      return {
        previousNurseId: previous,
        nurseId: String(b.nurseId),
        bookingNo: b.bookingNo as string,
        patientId: String(b.patientId),
      };
    });
    if (isRefusal(out)) return fail(out.error, out.status);
    const previousNurseId = out.previousNurseId;

    const assigned = await User.findById(out.nurseId).lean<{ name: string } | null>();

    await notify(
      out.nurseId,
      `Session assigned to you · ${out.bookingNo}`,
      reason ?? "Reassigned by the clinical team. The checklist is ready.",
      "info",
      "/nurse"
    );
    if (previousNurseId && previousNurseId !== out.nurseId) {
      await notify(
        previousNurseId,
        `Session reassigned · ${out.bookingNo}`,
        reason ?? "This is no longer on your route.",
        "warning",
        "/nurse"
      );
    }
    await notify(
      out.patientId,
      "Your nurse has changed",
      `${assigned?.name ?? "A nurse"} will attend ${out.bookingNo}.`,
      "info",
      "/app/sessions"
    );

    await AuditLog.create({
      actorId: session.sub,
      actorRole: session.role,
      action: "booking.reassign",
      entity: "Booking",
      entityId: id,
      before: { nurseId: previousNurseId },
      after: { nurseId: out.nurseId, reason },
    });

    return ok({ nurseId: out.nurseId, nurseName: assigned?.name ?? null });
  } catch (err) {
    return handleError(err);
  }
}
