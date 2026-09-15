import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { QuizFlow } from "./QuizFlow";
import { loadQuestions } from "@/lib/clinical/quiz-store";
import { requirePatientOnboarding } from "@/lib/auth/onboarding";

export const metadata: Metadata = { title: "Health quiz" };

/** Never cached — the quiz must reflect an admin edit immediately. */
export const dynamic = "force-dynamic";

export default async function QuizPage({
  searchParams,
}: {
  searchParams: Promise<{ drip?: string }>;
}) {
  const session = await getSession();
  // The quiz writes to a patient record, so it needs one first.
  if (!session) redirect("/login?next=/quiz");
  if (session.role !== "patient") redirect("/login?e=forbidden");

  // The quiz feeds a booking, and a booking needs somewhere to send a nurse.
  await requirePatientOnboarding(session);

  const { drip } = await searchParams;
  const questions = await loadQuestions();

  return <QuizFlow questions={questions} preferredDrip={drip ?? null} />;
}
