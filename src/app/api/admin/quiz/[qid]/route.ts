import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, HealthQuiz, QuizQuestion } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { loadQuestions } from "@/lib/clinical/quiz-store";
import { dependentsOf } from "@/lib/clinical/quiz-rules";
import { ok, fail, handleError } from "@/lib/api";

export async function DELETE(_req: Request, { params }: { params: Promise<{ qid: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "quiz.manage")) return fail("Not permitted", 403);

    const { qid } = await params;
    await connectDB();

    const question = await QuizQuestion.findOne({ qid });
    if (!question) return fail("Question not found", 404);

    // Removing a question another one follows would silently stop that one being
    // asked -- the follow-up needs this answer to decide. Say which, and why.
    const live = (await loadQuestions(true)).filter((q) => q.isActive !== false && q.id !== qid);
    const followers = dependentsOf(qid, live);
    if (followers.length) {
      const names = followers.map((q) => `“${q.question}”`).join(", ");
      return fail(
        `${names} ${followers.length === 1 ? "is" : "are"} only asked depending on the answer to this question. Change ${followers.length === 1 ? "that rule" : "those rules"} first.`,
        409,
        { dependents: followers.map((q) => q.id) }
      );
    }

    // Submissions store the question text they were answered against, but the
    // key still appears in old records — deactivating keeps history readable,
    // so a question that has been answered is retired rather than deleted.
    const answered = await HealthQuiz.countDocuments({ "answers.questionId": qid });

    if (answered > 0) {
      question.isActive = false;
      await question.save();
      await AuditLog.create({
        actorId: session!.sub,
        actorRole: session!.role,
        action: "quiz.question.retire",
        entity: "QuizQuestion",
        entityId: qid,
        after: { answered },
      });
      return ok({
        retired: true,
        answered,
        message: `${answered} submission${answered === 1 ? "" : "s"} already answered this, so it was retired rather than deleted — old results stay readable.`,
      });
    }

    await QuizQuestion.deleteOne({ qid });
    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "quiz.question.delete",
      entity: "QuizQuestion",
      entityId: qid,
    });

    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
