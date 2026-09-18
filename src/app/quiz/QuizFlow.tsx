"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { LogoMark } from "@/components/layout/Logo";
import type { QuizQuestion } from "@/lib/clinical/quiz";

/**
 * One question per screen. The progress bar is a Fill measuring answered
 * questions, and it carries its number like every other Fill.
 */
export function QuizFlow({
  questions,
  preferredDrip,
}: {
  questions: QuizQuestion[];
  preferredDrip: string | null;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const q = questions[index];
  const last = index === questions.length - 1;
  const answered = useMemo(() => Object.values(answers).filter((v) => v !== "").length, [answers]);
  const canAdvance = q.optional || q.type === "text" ? true : Boolean(answers[q.id]);

  const setAnswer = (value: string) => setAnswers((a) => ({ ...a, [q.id]: value }));

  const next = () => {
    if (last) return submit();
    setIndex((i) => Math.min(questions.length - 1, i + 1));
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not submit the quiz");
      else {
        const params = preferredDrip ? `?drip=${preferredDrip}` : "";
        router.push(`/app/results/${json.data.quizId}${params}`);
      }
    } catch {
      setError("Could not reach the server. Your answers are still on this screen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[var(--color-paper)] flex flex-col">
      {/* ---------------- Progress ---------------- */}
      <header className="sticky top-0 bg-[var(--color-paper)] border-b border-[var(--color-line)] z-20">
        <div className="mx-auto w-full max-w-[560px] px-5 py-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-[10px]">
              <LogoMark size={22} />
              <span className="t-micro">{q.section}</span>
            </div>
            <span className="t-data text-[13px] text-[var(--color-ink-2)]">
              {index + 1} / {questions.length}
            </span>
          </div>
          <div className="h-[6px] rounded-full bg-[var(--color-surface-2)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-150 ease-out"
              style={{ width: `${((index + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[560px] px-5 py-8 flex flex-col">
        <h1
          className="mb-2"
          style={{ font: "600 26px/1.25 var(--font-display)", letterSpacing: "-0.02em", textWrap: "pretty" }}
        >
          {q.question}
        </h1>
        {q.help && <p className="t-body text-[var(--color-ink-2)] mb-6">{q.help}</p>}

        <div className="flex flex-col gap-3 mt-4">
          {q.type === "text" ? (
            <Textarea
              label={q.optional ? "Optional" : "Your answer"}
              placeholder={q.optional ? "Leave blank if none" : "Type here"}
              value={answers[q.id] ?? ""}
              onChange={(e) => setAnswer(e.target.value)}
              rows={3}
            />
          ) : (
            q.options?.map((o) => {
              const selected = answers[q.id] === o.value;
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setAnswer(o.value)}
                  className="text-left min-h-[56px] px-5 rounded-[var(--radius-md)] border cursor-pointer flex items-center gap-4 transition-colors duration-150"
                  style={{
                    borderColor: selected ? "var(--color-primary)" : "var(--color-line)",
                    background: selected ? "var(--color-primary-soft)" : "var(--color-surface)",
                  }}
                >
                  <span
                    className="w-[18px] h-[18px] rounded-full flex-none"
                    style={{
                      border: selected ? "6px solid var(--color-primary)" : "1.5px solid var(--color-line-2)",
                      background: "var(--color-surface)",
                    }}
                  />
                  <span
                    style={{
                      font: `${selected ? 600 : 400} 16px/1.4 var(--font-sans)`,
                      color: "var(--color-ink)",
                    }}
                  >
                    {o.label}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {error && (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3 mt-6">
            <span className="t-body text-[var(--color-ink-2)]">{error}</span>
          </div>
        )}

        <div className="mt-auto pt-8 flex gap-3">
          {index > 0 && (
            <Button variant="secondary" size="lg" onClick={() => setIndex((i) => i - 1)}>
              Back
            </Button>
          )}
          <Button size="lg" block loading={busy} disabled={!canAdvance} onClick={next}>
            {last ? "See my results" : "Continue"}
          </Button>
        </div>

        <p className="t-small text-[var(--color-ink-3)] mt-4 text-center">
          {answered} of {questions.length} answered · a physician reads every submission
        </p>
      </main>
    </div>
  );
}
