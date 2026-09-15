import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Drip, HealthQuiz, User } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { scoreQuiz, suggestDripSlugs } from "@/lib/clinical/quiz";
import { loadQuestions } from "@/lib/clinical/quiz-store";
import { notifyRole } from "@/lib/notify";
import { ok, fail, handleError } from "@/lib/api";

const Input = z.object({
  answers: z.record(z.string(), z.string()),
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return fail("Sign in to submit the quiz", 401);
    if (session.role !== "patient") return fail("Only patients take the quiz", 403);

    const { answers } = Input.parse(await req.json());
    const questions = await loadQuestions();
    const scored = scoreQuiz(answers, questions);
    await connectDB();

    const slugs = suggestDripSlugs(scored.nutrientRisks);
    const drips = await Drip.find({ slug: { $in: slugs }, isActive: true }).lean<
      Array<{ _id: unknown; slug: string }>
    >();

    const quiz = await HealthQuiz.create({
      patientId: session.sub,
      answers: questions.filter((q) => answers[q.id]).map((q) => ({
        questionId: q.id,
        section: q.section,
        question: q.question,
        answer: answers[q.id],
      })),
      nutrientRisks: scored.nutrientRisks,
      vitalityScore: scored.vitalityScore,
      categoryScores: scored.categoryScores,
      suggestedDripIds: drips.map((d) => d._id),
      reviewStatus: "pending",
      completedAt: new Date(),
    });

    // The screening answers belong on the patient record too — the nurse reads
    // allergies aloud from there, not from the quiz.
    await User.findByIdAndUpdate(session.sub, {
      $set: {
        "patient.allergies": answers.allergies || undefined,
        "patient.currentMedications": answers.medications || undefined,
        "patient.chronicConditions": answers.conditions || undefined,
        "patient.vitalityScore": scored.vitalityScore,
        "patient.lastQuizAt": new Date(),
      },
    });

    await notifyRole(
      ["doctor", "admin"],
      "New assessment to review",
      `Vitality ${scored.vitalityScore}/100${
        scored.contraindications.length ? ` · ${scored.contraindications.length} screening flag(s)` : ""
      }`,
      scored.contraindications.length ? "warning" : "info",
      `/doctor/review/${String(quiz._id)}`
    );

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
