import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Drip, HealthQuiz, User } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { scoreQuiz, suggestDripSlugs, type Answer, type QuizQuestion } from "@/lib/clinical/quiz";
import { answerProblem, answersForVisible, readNumber, screeningFlags, tidyMulti } from "@/lib/clinical/quiz-rules";
import { loadQuestions } from "@/lib/clinical/quiz-store";
import { notifyRole } from "@/lib/notify";
import { ok, fail, handleError } from "@/lib/api";

const Input = z.object({
  // One string per question, or the list ticked for a multiple-choice question.
  answers: z.record(z.string(), z.union([z.string().max(2000), z.array(z.string().max(120)).max(40)])),
});

/**
 * An answer as it is kept on the record, for the physician to read.
 *
 * A number is kept with its unit ("7 hours"): the record is read by a person,
 * and "7" under "How long do you sleep?" is a guess away from "7 minutes". A
 * multiple-choice answer is kept as the list ticked, in the order offered.
 */
function stored(q: QuizQuestion, a: Answer): Answer {
  if (q.type === "multi" && Array.isArray(a)) return tidyMulti(q, a);
  if (q.type === "number") {
    const n = readNumber(a);
    return n === null ? String(a) : `${n}${q.unit ? ` ${q.unit}` : ""}`;
  }
  return a;
}

/** Profile fields are text; a list is written the way a person would say it. */
const asText = (a: Answer | undefined) => (Array.isArray(a) ? a.join(", ") : a) || undefined;

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return fail("Sign in to submit the quiz", 401);
    if (session.role !== "patient") return fail("Only patients take the quiz", 403);

    const { answers: sent } = Input.parse(await req.json());
    const questions = await loadQuestions();

    // Only the questions this patient was actually asked. An answer left on a
    // question their other answers hid is dropped here, on the server, so it can
    // neither be scored nor land on their record -- whatever the screen sent.
    const answers = answersForVisible(questions, sent);

    // Every answer must be one the question could have received. The screen
    // already checks, so this only refuses a submission that did not come from it.
    for (const q of questions) {
      const problem = answerProblem(q, answers[q.id]);
      if (problem) return fail(`\u201c${q.question}\u201d: ${problem}`, 422);
    }

    const scored = scoreQuiz(answers, questions);
    await connectDB();

    const slugs = suggestDripSlugs(scored.nutrientRisks);
    const drips = await Drip.find({ slug: { $in: slugs }, isActive: true }).lean<
      Array<{ _id: unknown; slug: string }>
    >();

    const quiz = await HealthQuiz.create({
      patientId: session.sub,
      answers: questions
        .filter((q) => answers[q.id] !== undefined)
        .map((q) => ({
          questionId: q.id,
          section: q.section,
          question: q.question,
          answer: stored(q, answers[q.id]!),
        })),
      nutrientRisks: scored.nutrientRisks,
      vitalityScore: scored.vitalityScore,
      categoryScores: scored.categoryScores,
      suggestedDripIds: drips.map((d) => d._id),
      screeningFlags: screeningFlags(questions, answers),
      reviewStatus: "pending",
      completedAt: new Date(),
    });

    /**
     * A retake replaces any earlier submission a physician has not decided on
     * yet -- still unread, or waiting on the patient's answer to a question. Two
     * undecided submissions from one patient meant the physician could approve
     * the old answers while the corrected ones sat unread behind them.
     *
     * Only OLDER ones: if two submissions ever cross, the newest survives rather
     * than each replacing the other. A decided one (approved, declined) is
     * history and is left alone.
     */
    const replaced = await HealthQuiz.updateMany(
      {
        patientId: session.sub,
        _id: { $ne: quiz._id },
        completedAt: { $lt: quiz.completedAt },
        reviewStatus: { $in: ["pending", "info_needed"] },
      },
      { $set: { reviewStatus: "superseded", supersededBy: quiz._id } }
    );

    // The screening answers belong on the patient record too — the nurse reads
    // allergies aloud from there, not from the quiz.
    await User.findByIdAndUpdate(session.sub, {
      $set: {
        "patient.allergies": asText(answers.allergies),
        "patient.currentMedications": asText(answers.medications),
        "patient.chronicConditions": asText(answers.conditions),
        "patient.vitalityScore": scored.vitalityScore,
        "patient.lastQuizAt": new Date(),
      },
    });

    await notifyRole(
      ["doctor", "admin"],
      replaced.modifiedCount ? "New answers to review" : "New assessment to review",
      `${replaced.modifiedCount ? "Replaces the earlier submission, which has left the queue · " : ""}Vitality ${scored.vitalityScore}/100${
        scored.contraindications.length ? ` · ${scored.contraindications.length} screening flag(s)` : ""
      }`,
      scored.contraindications.length ? "warning" : "info",
      `/doctor/review/${String(quiz._id)}`
    );

    await AuditLog.create({
      actorId: session?.sub,
      actorRole: session?.role ?? "patient",
      action: "quiz.submitted",
      entity: "HealthQuiz",
      entityId: String(quiz._id),
      after: {
        vitalityScore: scored.vitalityScore,
        screeningFlags: scored.contraindications.length,
        ...(replaced.modifiedCount ? { replacedEarlierSubmissions: replaced.modifiedCount } : {}),
      },
    });

    return ok(
      {
        quizId: String(quiz._id),
        vitalityScore: scored.vitalityScore,
        contraindications: scored.contraindications,
        suggested: drips.map((d) => d.slug),
      },
      { status: 201 }
    );
  } catch (err) {
    return handleError(err);
  }
}
