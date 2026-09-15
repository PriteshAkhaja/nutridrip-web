import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Booking, HealthQuiz } from "@/lib/models";
import { approvalState } from "@/lib/clinical/validity";
import { getSession } from "@/lib/auth/session";
import { canManageBooking } from "@/lib/auth/ownership";
import { notify } from "@/lib/notify";
import { LATE_CHANGE_HOURS } from "@/lib/clinical/slots";
import { ok, fail, handleError } from "@/lib/api";

const Input = z.object({ scheduledAt: z.string().datetime() });

/** Slots inside this window cannot be booked — the nurse needs the lead time. */
const MIN_LEAD_MS = 60 * 60_000;

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
    const { scheduledAt } = Input.parse(await req.json());
    await connectDB();

    const booking = await Booking.findById(id);
    if (!booking) return fail("Session not found", 404);

    const isOwner = session.role === "patient" && String(booking.patientId) === session.sub;
    if (!canManageBooking(session, booking)) return fail("Not permitted", 403);

    if (["completed", "in_progress", "cancelled", "rejected"].includes(booking.status)) {
      return fail("That session can no longer be moved", 409);
    }

    // A slot already in the past is the deepest part of the window, not outside
    // it: the nurse has been and gone.
    const hoursOut = (booking.scheduledAt.getTime() - Date.now()) / 3_600_000;
    if (isOwner && hoursOut < LATE_CHANGE_HOURS) {
      return fail(
        `Your slot is inside the ${LATE_CHANGE_HOURS}-hour window, so it cannot be moved — the nurse is already dispatched. Cancel instead if you need to; the late fee applies.`,
        409
      );
    }

    const next = new Date(scheduledAt);
    if (next.getTime() - Date.now() < MIN_LEAD_MS) return fail("Pick a slot at least an hour from now", 422);

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
      if (!approval.canBook && approval.status !== "pending") {
        return fail(approval.message, 409);
      }
    }

    const previous = booking.scheduledAt;
    booking.rescheduledFrom = previous;
    booking.scheduledAt = next;
    booking.rescheduleCount = (booking.rescheduleCount ?? 0) + 1;
    await booking.save();

    const when = next.toLocaleString("en-IN", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true,
    });
    await notify(
      booking.nurseId ? String(booking.nurseId) : null,
      `Session moved · ${booking.bookingNo}`,
      `Now ${when}. Your route has been updated.`,
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
      after: { scheduledAt: next },
    });

    return ok({ scheduledAt: next.toISOString(), rescheduleCount: booking.rescheduleCount });
  } catch (err) {
    return handleError(err);
  }
}
