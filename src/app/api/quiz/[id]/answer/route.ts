import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, HealthQuiz, User } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { notify, notifyRole } from "@/lib/notify";
import { ok, fail, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

const Input = z.object({ answer: z.string().min(1).max(2000) });

/**
 * The patient answering the question their physician asked.
 *
 * Answering puts the assessment back in the review queue rather than deciding
 * anything: the physician asked because they could not decide yet, and a reply
 * does not change that — it just means they can now.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session || session.role !== "patient") return fail("Not permitted", 403);

    const { id } = await params;
    const { answer } = Input.parse(await req.json());
    await connectDB();

    const quiz = await HealthQuiz.findById(id);
    if (!quiz) return fail("Assessment not found", 404);
    // A patient may only ever answer their own.
    if (String(quiz.patientId) !== session.sub) return fail("Not permitted", 403);
    if (quiz.reviewStatus !== "info_needed") {
      return fail("Nothing has been asked on this assessment", 409);
    }

    quiz.infoAnswer = answer.trim();
    quiz.infoAnsweredAt = new Date();
    // Back to pending, so it reappears in the physician's queue rather than
    // sitting answered and unread in a state nobody looks at.
    quiz.reviewStatus = "pending";
    await quiz.save();

    const patient = await User.findById(session.sub).lean<{ name: string } | null>();
    const who = patient?.name ?? "A patient";
    const title = `${who} answered your question`;
    const body = `${quiz.infoRequest ? `"${quiz.infoRequest}" — ` : ""}${answer.trim()}`;

    // Back to the physician who asked; to all of them if that account is gone.
    if (quiz.reviewedBy) await notify(String(quiz.reviewedBy), title, body, "info", `/doctor/review/${id}`);
    else await notifyRole("doctor", title, body, "info", `/doctor/review/${id}`);

    await AuditLog.create({
      actorId: session.sub,
      actorRole: session.role,
      action: "quiz.info.answered",
      entity: "HealthQuiz",
      entityId: id,
      after: { question: quiz.infoRequest, answer: answer.trim() },
    });

    return ok({ answered: true });
  } catch (err) {
    return handleError(err);
  }
}
