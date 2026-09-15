import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Booking, User } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { notify } from "@/lib/notify";
import { ok, fail, handleError } from "@/lib/api";

const Input = z.object({
  decision: z.enum(["clear", "stop"]),
  note: z.string().max(1000).optional(),
});

/**
 * Out-of-range vitals block the infusion and the nurse cannot override it.
 * This is the physician's answer: proceed under their name, or stand the
 * session down. Either way the patient and the nurse are told.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || !["doctor", "superadmin"].includes(session.role)) {
      return fail("Only a physician can clear a blocked infusion", 403);
    }

    const { id } = await params;
    const { decision, note } = Input.parse(await req.json());
    await connectDB();

    const booking = await Booking.findById(id);
    if (!booking) return fail("Session not found", 404);
    if (["completed", "cancelled", "rejected"].includes(booking.status)) {
      return fail("That session is already closed", 409);
    }

    const flagged = (booking.vitals ?? []).some(
      (v: { outOfRange?: string[] }) => (v.outOfRange ?? []).length > 0
    );
    if (!flagged) return fail("Nothing is blocking this session", 409);
    if (decision === "clear" && booking.vitalsClearedAt) return fail("Already cleared", 409);

    const doctor = await User.findById(session.sub).lean<{ name: string } | null>();
    const who = doctor?.name ?? "The physician";

    if (decision === "clear") {
      booking.vitalsClearedAt = new Date();
      booking.vitalsClearedBy = session.sub;
      booking.vitalsClearanceNote = note;
      // Only a physician's id belongs in doctorId — it is printed on the
      // patient's report as the reviewing physician, and escalations route to
      // it. A super admin acting as break-glass must not be named as one.
      if (!booking.doctorId && session.role === "doctor") booking.doctorId = session.sub;
      await booking.save();

      await notify(
        booking.nurseId ? String(booking.nurseId) : null,
        `Cleared to proceed · ${booking.bookingNo}`,
        note || `${who} has reviewed the baseline vitals. The infusion may start.`,
        "success",
        `/nurse/session/${id}`
      );
      await notify(
        String(booking.patientId),
        "Your physician has reviewed your vitals",
        "The session can go ahead.",
        "success",
        "/app"
      );
    } else {
      // A session that has not started is stood down outright. One already
      // running is a different matter: the nurse still has to remove the
      // cannula, take closing vitals and give aftercare, and cancelling would
      // lock them out of the checklist mid-infusion. So it stays in progress,
      // with the stop recorded, and closes the normal way.
      const running = booking.status === "in_progress" || Boolean(booking.startedAt);
      if (running) {
        booking.vitalsClearanceNote = note || "Physician stopped the infusion. Complete the post-session steps.";
        booking.observations.push({
          at: new Date(),
          text: `Physician stopped the infusion${note ? `: ${note}` : "."} Remove the cannula and complete the post-session steps.`,
          byId: session.sub,
        });
      } else {
        booking.status = "cancelled";
        booking.cancelledAt = new Date();
        booking.cancelReason = note || "Stopped by the physician after out-of-range baseline vitals";
      }
      if (!booking.doctorId && session.role === "doctor") booking.doctorId = session.sub;
      await booking.save();

      await notify(
        booking.nurseId ? String(booking.nurseId) : null,
        running ? `Stop the infusion · ${booking.bookingNo}` : `Session stood down · ${booking.bookingNo}`,
        running
          ? note || `${who} has stopped the infusion. Remove the cannula and complete the post-session steps.`
          : note || `${who} has stopped this session. Do not cannulate.`,
        "error",
        running ? `/nurse/session/${id}` : "/nurse"
      );
      await notify(
        String(booking.patientId),
        "Your session was stopped by the physician",
        note || "Your baseline readings were outside the safe range today. Nothing is charged.",
        "warning",
        "/app/sessions"
      );
    }

    await AuditLog.create({
      actorId: session.sub,
      actorRole: session.role,
      action: decision === "clear" ? "vitals.cleared" : "vitals.stopped",
      entity: "Booking",
      entityId: id,
      after: { note },
    });

    return ok({ decision, status: booking.status, clearedAt: booking.vitalsClearedAt ?? null });
  } catch (err) {
    return handleError(err);
  }
}
