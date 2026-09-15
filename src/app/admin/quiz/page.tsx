import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { adminNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { loadQuestions } from "@/lib/clinical/quiz-store";
import { MARKERS } from "@/lib/clinical/quiz";
import { connectDB } from "@/lib/db/mongoose";
import { HealthQuiz } from "@/lib/models";
import { QuizEditor } from "./QuizEditor";

export const metadata: Metadata = { title: "Quiz builder" };
export const dynamic = "force-dynamic";

export default async function QuizAdminPage() {
  const session = await requireRole("superadmin", "admin");
  const nav = await adminNav();
  const questions = await loadQuestions(true);

  await connectDB();
  // How many submissions have answered each key, so the editor can warn before
  // a question that carries history is changed.
  const rows = await HealthQuiz.aggregate<{ _id: string; count: number }>([
    { $unwind: "$answers" },
    { $group: { _id: "$answers.questionId", count: { $sum: 1 } } },
  ]);
  const answeredByQid = Object.fromEntries(rows.map((r) => [r._id, r.count]));

  return (
    <ConsoleShell
      session={session}
      roleLabel={session.role === "superadmin" ? "Super admin" : "Admin"}
      nav={nav}
      activeHref="/admin/quiz"
      breadcrumb={["Platform", "Quiz builder"]}
      title="Health quiz"
      meta={`${questions.length} questions`}
    >
      <p className="t-body text-[var(--color-ink-2)] max-w-[76ch] mb-6" style={{ textWrap: "pretty" }}>
        This is the questionnaire every patient answers, and it is live — a change here reaches the next patient who
        opens the quiz, with no deploy. Each answer carries a score from 0 to 100, and the markers it feeds are
        weighted 0 to 1. A patient&apos;s vitality score is the average of all sixteen markers afterwards.
      </p>

      <QuizEditor
        initial={questions}
        markers={MARKERS.map((m) => m.name)}
        answeredByQid={answeredByQid}
      />
    </ConsoleShell>
  );
}
