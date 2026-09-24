import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Booking, User } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { notify } from "@/lib/notify";
import { LOW_RATING, isLow, readFeedback } from "@/lib/clinical/feedback";
import { ok, fail, handleError } from "@/lib/api";

const Rating = z.number().int().min(1).max(5);
const Comment = z.string().trim().max(2000).optional();

/** Two parts: the nurse who looked after the patient, and the session itself. */
const Input = z.object({
  nurseRating: Rating.optional(),
  nurseComment: Comment,
  sessionRating: Rating,
  sessionComment: Comment,
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "patient") return fail("Not permitted", 403);

    const { id } = await params;
    const input = Input.parse(await req.json());
    await connectDB();

    const booking = await Booking.findById(id);
    if (!booking) return fail("Session not found", 404);
    if (String(booking.patientId) !== session.sub) return fail("Not permitted", 403);
    if (booking.status !== "completed") return fail("Rate a session once it is finished", 409);
    // A nurse ran it, so the nurse is rated too -- that half is the one their
    // record, and the patient's promise that "your nurse sees this", rest on.
    if (booking.nurseId && !input.nurseRating) return fail("Rate your nurse as well as the session", 422);

    // A server started before the two parts existed would drop them and save nothing.
    if (!Booking.schema.path("feedback.nurseRating")) {
      return fail("The server is running an older version and would lose this. Restart it (stop it and run npm run dev again).", 500);
    }

    booking.feedback = {
      nurseRating: booking.nurseId ? input.nurseRating : undefined,
      nurseComment: booking.nurseId ? input.nurseComment || undefined : undefined,
      sessionRating: input.sessionRating,
      sessionComment: input.sessionComment || undefined,
      givenAt: new Date(),
    };
    await booking.save();

    const view = readFeedback(booking.feedback);
    const patient = await User.findById(booking.patientId).lean<{ name: string } | null>();
    const who = patient?.name ?? "A patient";

    // The nurse hears what was said about them -- good or bad, first-hand.
    if (booking.nurseId && view?.nurse) {
      await notify(
        String(booking.nurseId),
        `${who} rated your care on ${booking.bookingNo} · ${view.nurse.rating}/5`,
        view.nurse.comment ?? "No comment left.",
        view.nurse.rating <= LOW_RATING ? "warning" : "success",
        `/nurse/session/${id}/report`
      );
    }

    // Anything low -- the nurse, or how the patient felt -- goes to the physician
    // who approved the protocol, with both halves so they see the whole picture.
    if (isLow(view) && booking.doctorId) {
      const part = (label: string, r: { rating: number; comment: string | null } | null) =>
        r ? `${label} ${r.rating}/5${r.comment ? ` — ${r.comment}` : ""}` : null;
      await notify(
        String(booking.doctorId),
        `Low rating on ${booking.bookingNo}`,
        [part("Nurse", view?.nurse ?? null), part("Session", view?.session ?? null)].filter(Boolean).join(" · "),
        "warning",
        // The patient's record, where every session's feedback is shown.
        `/doctor/patients/${String(booking.patientId)}`
      );
    }

    await AuditLog.create({
      actorId: session.sub,
      actorRole: session.role,
      action: "feedback.given",
      entity: "Booking",
      entityId: id,
      after: { bookingNo: booking.bookingNo, nurseRating: view?.nurse?.rating ?? null, sessionRating: view?.session?.rating ?? null },
    });

    return ok({ feedback: view });
  } catch (err) {
    return handleError(err);
  }
}
