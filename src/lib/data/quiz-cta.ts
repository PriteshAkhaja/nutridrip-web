import { cache } from "react";
import { connectDB } from "@/lib/db/mongoose";
import { HealthQuiz } from "@/lib/models";
import type { SessionPayload } from "@/lib/auth/session";
import { approvalState } from "@/lib/clinical/validity";

/**
 * Where a "Take the quiz" button should lead this visitor.
 *
 * The quiz is taken once and then holds for the approval window, so a patient
 * who has already answered must not be walked back through it by a button on
 * the website -- they would answer everything again and put a second
 * submission in front of the physician. Instead the same button takes them to
 * the next thing they can actually do. Retaking is a deliberate choice, made
 * from Home or Profile, and reaches the quiz as `/quiz?retake=1`.
 *
 * Null means "the quiz, as the button says": a visitor who is not signed in,
 * staff, or a patient who has never answered.
 */
export type QuizCta = { label: string; short: string; href: string };

/** One read per request, however many buttons are on the page. */
const latestQuiz = cache(async (patientId: string) => {
  await connectDB();
  return HealthQuiz.findOne({ patientId })
    .sort({ completedAt: -1 })
    .select({ reviewStatus: 1, reviewedAt: 1, completedAt: 1 })
    .lean<{ _id: unknown; reviewStatus: string; reviewedAt?: Date; completedAt: Date } | null>();
});

export async function quizCtaFor(session: SessionPayload | null, drip?: string | null): Promise<QuizCta | null> {
  if (session?.role !== "patient") return null;

  const quiz = await latestQuiz(session.sub);
  if (!quiz) return null;

  const withDrip = (base: string, joiner: "?" | "&") => (drip ? `${base}${joiner}drip=${encodeURIComponent(drip)}` : base);
  const approval = approvalState(quiz);

  switch (approval.status) {
    // Approved, or still with the physician: a slot can be booked (held, while pending).
    case "valid":
    case "expiring":
    case "pending":
      return {
        label: drip ? "Book this drip" : "Book a session",
        short: "Book a session",
        href: withDrip("/app/book", "?"),
      };
    // Nothing moves until the patient answers, and the question is on their results.
    case "info_needed":
      return { label: "Answer your physician", short: "Answer your physician", href: `/app/results/${String(quiz._id)}` };
    // The reason for a decline is on the results page.
    case "rejected":
      return { label: "See your results", short: "Your results", href: `/app/results/${String(quiz._id)}` };
    // The approval ran out: answering again is the only way on, so here the quiz is right.
    case "expired":
      return { label: "Retake the health quiz", short: "Retake the quiz", href: withDrip("/quiz?retake=1", "&") };
    default:
      return null;
  }
}
