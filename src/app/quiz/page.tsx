import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { QuizFlow } from "./QuizFlow";
import { loadQuestions } from "@/lib/clinical/quiz-store";
import { requirePatientOnboarding } from "@/lib/auth/onboarding";
import { quizCtaFor } from "@/lib/data/quiz-cta";
import { connectDB } from "@/lib/db/mongoose";
import { HealthQuiz } from "@/lib/models";
import { approvalState } from "@/lib/clinical/validity";

/** What a retake will do, in the patient's terms, by where their last answers stand. */
async function retakeNoteFor(patientId: string): Promise<string | null> {
  await connectDB();
  const latest = await HealthQuiz.findOne({ patientId })
    .sort({ completedAt: -1 })
    .lean<{ reviewStatus: string; reviewedAt?: Date; completedAt: Date } | null>();
  const approval = approvalState(latest);
  if (approval.canHold) {
    return "These answers replace the ones your physician has not decided on yet. They will read these instead.";
  }
  if (approval.canBook) {
    return "A physician reads your new answers before your next booking is confirmed. Sessions already booked stay as they are, unless the physician finds something in your new answers that rules them out.";
  }
  return null;
}

export const metadata: Metadata = { title: "Health quiz" };

/** Never cached — the quiz must reflect an admin edit immediately. */
export const dynamic = "force-dynamic";

export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{ drip?: string; retake?: string }>;
}) {
  const session = await getSession();
  // The quiz writes to a patient record, so it needs one first.
  if (!session) redirect("/login?next=/quiz");
  if (session.role !== "patient") redirect("/login?e=forbidden");

  // The quiz feeds a booking, and a booking needs somewhere to send a nurse.
  await requirePatientOnboarding(session);

  const { drip, retake } = await searchParams;

  // Taken once, the quiz holds for the approval window. A patient who has
  // already answered reaches it again only by choosing to retake (Home or
  // Profile), never by following a "Take the quiz" link on the website.
  if (retake !== "1") {
    const next = await quizCtaFor(session, drip);
    if (next) redirect(next.href);
  }

  const questions = await loadQuestions();
  const retakeNote = retake === "1" ? await retakeNoteFor(session.sub) : null;

  return <QuizFlow questions={questions} preferredDrip={drip ?? null} retakeNote={retakeNote} />;
}
