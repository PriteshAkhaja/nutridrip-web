"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, Checkbox } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";
import { FillBar } from "@/components/ui/Fill";
import type { QuizQuestion } from "@/lib/clinical/quiz";

type Draft = {
  qid: string;
  section: string;
  question: string;
  help: string;
  type: "single" | "multi" | "text" | "number";
  options: Array<{ value: string; label: string; score: number }>;
  affects: Record<string, number>;
  optional: boolean;
  contraindicationIf: string[];
  isActive: boolean;
};

const blank = (): Draft => ({
  qid: "",
  section: "Sleep & energy",
  question: "",
  help: "",
  type: "single",
  options: [
    { value: "Yes", label: "Yes", score: 80 },
    { value: "No", label: "No", score: 30 },
  ],
  affects: {},
  optional: false,
  contraindicationIf: [],
  isActive: true,
});

const toDraft = (q: QuizQuestion): Draft => ({
  qid: q.id,
  section: q.section,
  question: q.question,
  help: q.help ?? "",
  type: q.type,
  options: (q.options ?? []).map((o) => ({ ...o })),
  affects: Object.fromEntries(
    Object.entries(q.affects ?? {}).filter(([, v]) => v !== undefined) as Array<[string, number]>
  ),
  optional: q.optional ?? false,
  contraindicationIf: q.contraindicationIf ?? [],
  isActive: true,
});

export function QuizEditor({
  initial,
  markers,
  answeredByQid,
}: {
  initial: QuizQuestion[];
  markers: string[];
  answeredByQid: Record<string, number>;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const sections = [...new Set(initial.map((q) => q.section))];

  const save = async () => {
    if (!editing) return;
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch("/api/admin/quiz", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editing),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not save that question");
      else {
        setEditing(null);
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. Nothing was saved.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (qid: string) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/quiz/${qid}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not remove that question");
      else {
        if (json.data.retired) setNote(json.data.message);
        setEditing(null);
        router.refresh();
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    setBusy(true);
    try {
      await fetch("/api/admin/quiz", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
      setEditing(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  /* ---------------- Editor ---------------- */
  if (editing) {
    const answered = answeredByQid[editing.qid] ?? 0;
    return (
      <Card padding="p-6">
        <div className="flex items-baseline justify-between gap-4 mb-5 flex-wrap">
          <h2 className="t-h3">{editing.qid ? `Editing "${editing.qid}"` : "New question"}</h2>
          <Button variant="ghost" onClick={() => setEditing(null)}>
            Cancel
          </Button>
        </div>

        {answered > 0 && (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-caution)] bg-[var(--color-caution-soft)] px-4 py-3 mb-5">
            <span className="t-body text-[var(--color-ink-2)]">
              <span className="t-data text-[14.5px]">{answered}</span> submission
              {answered === 1 ? " has" : "s have"} already answered this. Changing the scores does not rescore old
              results — they keep the numbers they were given at the time.
            </span>
          </div>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <Input
            label="Answer key"
            hint="letters, numbers, hyphens"
            mono
            value={editing.qid}
            disabled={Boolean(answeredByQid[editing.qid])}
            onChange={(e) => setEditing({ ...editing, qid: e.target.value })}
            placeholder="sleep-hours"
          />
          <Input
            label="Section"
            list="quiz-sections"
            value={editing.section}
            onChange={(e) => setEditing({ ...editing, section: e.target.value })}
          />
          <datalist id="quiz-sections">
            {sections.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <Textarea
            label="The question"
            rows={2}
            value={editing.question}
            onChange={(e) => setEditing({ ...editing, question: e.target.value })}
            placeholder="How many hours do you usually sleep?"
          />
          <Input
            label="Helper text"
            hint="optional"
            value={editing.help}
            onChange={(e) => setEditing({ ...editing, help: e.target.value })}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              label="Answer type"
              value={editing.type}
              onChange={(e) => setEditing({ ...editing, type: e.target.value as Draft["type"] })}
            >
              <option value="single">Single choice</option>
              <option value="text">Free text</option>
              <option value="number">Number</option>
            </Select>
            <div className="flex items-end gap-4">
              <Checkbox
                label="Optional"
                checked={editing.optional}
                onChange={(v) => setEditing({ ...editing, optional: v })}
              />
              <Checkbox
                label="Live"
                checked={editing.isActive}
                onChange={(v) => setEditing({ ...editing, isActive: v })}
              />
            </div>
          </div>
        </div>

        {/* ---------------- Options ---------------- */}
        {editing.type === "single" && (
          <div className="mt-6">
            <span className="t-micro block mb-3">
              Options · a score of 100 is ideal, 0 is worst
            </span>
            <div className="flex flex-col gap-3">
              {editing.options.map((o, i) => (
                <div key={i} className="grid gap-3 sm:grid-cols-[1fr_110px_auto] items-end">
                  <Input
                    label={i === 0 ? "Label" : undefined}
                    value={o.label}
                    onChange={(e) => {
                      const options = [...editing.options];
                      options[i] = { ...o, label: e.target.value, value: e.target.value };
                      setEditing({ ...editing, options });
                    }}
                  />
                  <Input
                    label={i === 0 ? "Score" : undefined}
                    type="number"
                    min={0}
                    max={100}
                    mono
                    value={o.score}
                    onChange={(e) => {
                      const options = [...editing.options];
                      options[i] = { ...o, score: Number(e.target.value) };
                      setEditing({ ...editing, options });
                    }}
                  />
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setEditing({ ...editing, options: editing.options.filter((_, n) => n !== i) })
                    }
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <Button
                variant="secondary"
                onClick={() =>
                  setEditing({
                    ...editing,
                    options: [...editing.options, { value: "", label: "", score: 50 }],
                  })
                }
              >
                Add an option
              </Button>
            </div>
          </div>
        )}

        {/* ---------------- Markers ---------------- */}
        <div className="mt-6">
          <span className="t-micro block mb-1">Which markers this answer moves</span>
          <p className="t-small text-[var(--color-ink-2)] mb-3 max-w-[62ch]">
            Weight 0 to 1. A marker at 1 takes this answer&apos;s score at full strength; at 0.5 it counts half as
            much as another question feeding the same marker. Leave a marker at 0 and it is not touched.
          </p>
          <div className="grid gap-x-6 gap-y-3 md:grid-cols-2">
            {markers.map((m) => {
              const weight = editing.affects[m] ?? 0;
              return (
                <label key={m} className="flex items-center gap-3">
                  <span className="t-body flex-1 min-w-0 truncate">{m}</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={weight}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      const affects = { ...editing.affects };
                      if (v === 0) delete affects[m];
                      else affects[m] = v;
                      setEditing({ ...editing, affects });
                    }}
                    className="w-[120px] accent-[var(--color-primary)]"
                    aria-label={`${m} weight`}
                  />
                  <span className="t-data text-[13px] w-[28px] text-right">{weight.toFixed(1)}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* ---------------- Contraindication ---------------- */}
        {editing.type === "single" && editing.options.length > 0 && (
          <div className="mt-6">
            <span className="t-micro block mb-3">
              Answers that must stop a booking
            </span>
            <div className="flex gap-2 flex-wrap">
              {editing.options.map((o) => {
                const on = editing.contraindicationIf.includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setEditing({
                        ...editing,
                        contraindicationIf: on
                          ? editing.contraindicationIf.filter((v) => v !== o.value)
                          : [...editing.contraindicationIf, o.value],
                      })
                    }
                    className="min-h-[44px] px-4 rounded-[var(--radius-sm)] border cursor-pointer text-[14.5px]"
                    style={{
                      borderColor: on ? "var(--color-critical)" : "var(--color-line-2)",
                      background: on ? "var(--color-critical-soft)" : "var(--color-surface)",
                      color: on ? "var(--color-critical)" : "var(--color-ink)",
                      fontWeight: on ? 600 : 400,
                    }}
                  >
                    {o.label || "(unnamed)"}
                  </button>
                );
              })}
            </div>
            <p className="t-small text-[var(--color-ink-3)] mt-2">
              Flagged answers are shown to the reviewing physician as a screening flag on the submission.
            </p>
          </div>
        )}

        {error && (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3 mt-5">
            <span className="t-body text-[var(--color-ink-2)]">{error}</span>
          </div>
        )}

        <div className="flex gap-2 mt-6 flex-wrap">
          <Button size="lg" loading={busy} disabled={!editing.qid || !editing.question} onClick={save}>
            Save question
          </Button>
          {answeredByQid[editing.qid] !== undefined || initial.some((q) => q.id === editing.qid) ? (
            <Button variant="danger" loading={busy} onClick={() => remove(editing.qid)}>
              Remove
            </Button>
          ) : null}
        </div>
      </Card>
    );
  }

  /* ---------------- List ---------------- */
  return (
    <div>
      {note && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-info)] bg-[var(--color-info-soft)] px-4 py-3 mb-5">
          <span className="t-body text-[var(--color-ink-2)]">{note}</span>
        </div>
      )}
      {error && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3 mb-5">
          <span className="t-body text-[var(--color-ink-2)]">{error}</span>
        </div>
      )}

      <div className="flex gap-2 mb-5 flex-wrap">
        <Button onClick={() => setEditing(blank())}>Add a question</Button>
        <Button variant="secondary" loading={busy} onClick={restore}>
          Restore the default set
        </Button>
      </div>

      <div className="flex flex-col gap-6">
        {sections.map((section) => (
          <section key={section}>
            <h2 className="t-h3 mb-3">{section}</h2>
            <div className="flex flex-col gap-3">
              {initial
                .filter((q) => q.section === section)
                .map((q) => {
                  const answered = answeredByQid[q.id] ?? 0;
                  const weights = Object.entries(q.affects ?? {}).filter(([, v]) => (v ?? 0) > 0);
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setEditing(toDraft(q))}
                      className="text-left rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 cursor-pointer hover:border-[var(--color-primary-line)] transition-colors duration-150"
                    >
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-3 flex-wrap">
                            <span className="t-data text-[13px] text-[var(--color-ink-3)]">{q.id}</span>
                            {q.optional && <Pill tone="neutral">Optional</Pill>}
                            {(q.contraindicationIf ?? []).length > 0 && (
                              <Pill tone="critical" dot>
                                Screening
                              </Pill>
                            )}
                            {answered > 0 && (
                              <span className="t-small text-[var(--color-ink-3)]">
                                {answered} answered
                              </span>
                            )}
                          </div>
                          <p className="t-body font-medium mt-1">{q.question}</p>
                          {q.options && q.options.length > 0 && (
                            <p className="t-small text-[var(--color-ink-3)] mt-1">
                              {q.options.map((o) => `${o.label} (${o.score})`).join(" · ")}
                            </p>
                          )}
                        </div>

                        {weights.length > 0 && (
                          <div className="w-[220px] flex-none flex flex-col gap-2">
                            {weights.slice(0, 3).map(([m, v]) => (
                              <FillBar
                                key={m}
                                label={<span className="t-small">{m}</span>}
                                value={(v ?? 0).toFixed(1)}
                                pct={(v ?? 0) * 100}
                                height={4}
                              />
                            ))}
                            {weights.length > 3 && (
                              <span className="t-small text-[var(--color-ink-3)]">
                                +{weights.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
