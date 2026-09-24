import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Booking, User } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { canManageBooking } from "@/lib/auth/ownership";
import { notify } from "@/lib/notify";
import { pickNurse } from "@/lib/clinical/assign";
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
    if (["completed", "cancelled"].includes(booking.status)) {
      return fail("That session is finished — there is nothing to reassign", 409);
    }
    if (booking.status === "in_progress") {
      return fail("The infusion has started. Swapping the nurse mid-session is not safe.", 409);
    }

    const previousNurseId = booking.nurseId ? String(booking.nurseId) : null;

    if (nurseId) {
      const nurse = await User.findById(nurseId).lean<{ name: string; role: string; status: string } | null>();
      if (!nurse || nurse.role !== "nurse") return fail("That is not a nurse account", 422);
      if (nurse.status !== "active") return fail(`${nurse.name} is not active`, 409);
      // One nurse, one door at a time: the session plus the travel after it.
      const theirs = await Booking.find({
        _id: { $ne: booking._id },
        nurseId,
        status: { $in: HOLDING_STATUSES },
        scheduledAt: { $gte: new Date(booking.scheduledAt.getTime() - 86_400_000), $lte: new Date(booking.scheduledAt.getTime() + 86_400_000) },
      })
        .select("bookingNo scheduledAt durationMin")
        .lean<Array<{ bookingNo: string; scheduledAt: Date; durationMin?: number }>>();
      const clash = theirs.find((b) =>
        clashes(booking.scheduledAt.getTime(), booking.durationMin ?? 45, new Date(b.scheduledAt).getTime(), b.durationMin ?? 45)
      );
      if (clash) {
        return fail(
          `${nurse.name} already has ${clash.bookingNo} at ${istParts(new Date(clash.scheduledAt)).time}, and needs ${BETWEEN_SESSIONS_MIN} minutes to travel on. Choose another nurse, or move one of the sessions.`,
          409
        );
      }
      booking.nurseId = nurseId;
    } else {
      const patient = await User.findById(booking.patientId).lean<{
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
          excludeNurseId: previousNurseId,
          session: { start: booking.scheduledAt, durationMin: booking.durationMin ?? 45, bookingId: String(booking._id) },
        }
      );
      if (!pick) return fail("No other nurse is available under capacity right now", 409);
      booking.nurseId = pick.nurseId;
    }

    if (booking.status === "approved") booking.status = "nurse_assigned";
    await booking.save();

    const assigned = await User.findById(booking.nurseId).lean<{ name: string } | null>();

    await notify(
      String(booking.nurseId),
      `Session assigned to you · ${booking.bookingNo}`,
      reason ?? "Reassigned by the clinical team. The checklist is ready.",
      "info",
      "/nurse"
    );
    if (previousNurseId && previousNurseId !== String(booking.nurseId)) {
      await notify(
        previousNurseId,
        `Session reassigned · ${booking.bookingNo}`,
        reason ?? "This is no longer on your route.",
        "warning",
        "/nurse"
      );
    }
    await notify(
      String(booking.patientId),
      "Your nurse has changed",
      `${assigned?.name ?? "A nurse"} will attend ${booking.bookingNo}.`,
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
      after: { nurseId: String(booking.nurseId), reason },
    });

    return ok({ nurseId: String(booking.nurseId), nurseName: assigned?.name ?? null });
  } catch (err) {
    return handleError(err);
  }
}
