"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox, Input, Textarea } from "@/components/ui/Field";
import type { QuizQuestion, QuizType } from "@/lib/clinical/quiz";
import { dependentsOf, describeShowIf, groupBySection, newProblems, rangeWords } from "@/lib/clinical/quiz-rules";
import { RuleBuilder, TYPE_LABEL } from "./RuleBuilder";
import { NEW_ID, draftToDef, draftToPayload, numberSettingsProblem, type Draft } from "./draft";

const TYPES: Array<{ value: QuizType; body: string }> = [
  { value: "single", body: "Pick one answer" },
  { value: "multi", body: "Tick all that apply" },
  { value: "number", body: "Type a number, like hours or kg" },
  { value: "text", body: "Write an answer in their own words" },
];

const KEY = /^[a-z0-9-]+$/i;

type Confirm = { title: string; body: string; cta: string } | null;

export function QuestionForm({
  initialDraft,
  isNew,
  questions,
  markers,
  answered,
  onCancel,
  onDone,
}: {
  initialDraft: Draft;
  isNew: boolean;
  /** Every question, live or not, in the order a patient meets them. */
  questions: QuizQuestion[];
  markers: string[];
  /** How many submissions have answered this question already. */
  answered: number;
  onCancel: () => void;
  onDone: (message: string) => void;
}) {
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const choice = draft.type === "single" || draft.type === "multi";
  const sections = [...new Set(questions.map((q) => q.section))];
  const keyTaken = isNew && questions.some((q) => q.id === draft.qid);
  const keyProblem = !draft.qid
    ? null
    : !KEY.test(draft.qid)
      ? "Letters, numbers and hyphens only."
      : keyTaken
        ? "Another question already uses this key."
        : null;

  // The questionnaire as it would stand after saving, checked with the same
  // rules the server applies -- so a rule that cannot work is shown here, while
  // it is being written, not after a round trip.
  const { after, earlier, byId, problems, summary } = useMemo(() => {
    const def = draftToDef(draft);
    const list = groupBySection(
      isNew ? [...questions, def] : questions.map((q) => (q.id === initialDraft.qid ? def : q))
    );
    const at = list.findIndex((q) => q.id === def.id);
    const map = new Map(list.map((q) => [q.id, q]));
    return {
      after: list,
      earlier: list.slice(0, at).filter((q) => q.isActive !== false && q.id !== NEW_ID),
      byId: map,
      problems: newProblems(questions, list),
      summary: describeShowIf(def, map),
    };
  }, [draft, questions, isNew, initialDraft.qid]);

  // The questions that follow this one: their rules read its answers.
  const followers = isNew ? [] : dependentsOf(initialDraft.qid, after.filter((q) => q.isActive !== false));
  const numberProblem = numberSettingsProblem(draft);
  const typeChanged = !isNew && answered > 0 && draft.type !== initialDraft.type;

  const blocked = !draft.qid || !draft.question.trim() || Boolean(keyProblem) || Boolean(numberProblem) || problems.length > 0;

  const renameOption = (i: number, label: string) => {
    const old = draft.options[i].value;
    const options = draft.options.map((o, n) => (n === i ? { ...o, label, value: label } : o));
    // A screening flag follows its answer when the answer is renamed.
    const contraindicationIf = draft.contraindicationIf.map((v) => (v === old ? label : v));
    setDraft({ ...draft, options, contraindicationIf });
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/quiz", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(draftToPayload(draft, isNew)),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not save that question");
      else onDone(`Saved “${draft.question.trim()}”. The next patient to open the quiz gets it.`);
    } catch {
      setError("Could not reach the server. Nothing was saved.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/quiz/${initialDraft.qid}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not remove that question");
      else onDone(json.data.retired ? json.data.message : `Removed “${initialDraft.question}”.`);
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  return (
    <Card padding="p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-4 mb-5 flex-wrap">
        <h2 className="t-h3">{isNew ? "New question" : `Editing “${initialDraft.qid}”`}</h2>
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>

      {answered > 0 && (
        <Notice tone="caution">
          <span className="t-data text-[14.5px]">{answered}</span> submission{answered === 1 ? " has" : "s have"} already
          answered this. Changing the scores does not rescore old results — they keep the numbers they were given at the
          time.
        </Notice>
      )}

      {followers.length > 0 && (
        <Notice tone="info">
          <span className="block mb-1">
            {followers.length === 1 ? "One question is" : `${followers.length} questions are`} asked depending on the
            answer to this one:
          </span>
          <ul className="list-disc pl-5 m-0">
            {followers.map((f) => (
              <li key={f.id}>
                <span className="font-medium">{f.question}</span>
                <span className="text-[var(--color-ink-3)]"> — {describeShowIf(f, byId)?.replace(/^Asked /, "asked ")}</span>
              </li>
            ))}
          </ul>
          <span className="block mt-1 text-[var(--color-ink-3)]">
            Removing or renaming an answer those rules use, or taking this question out of the quiz, is refused until
            the rules are changed.
          </span>
        </Notice>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Input
          label="Answer key"
          hint={isNew ? "letters, numbers, hyphens" : "fixed once created"}
          mono
          value={draft.qid}
          disabled={!isNew}
          error={keyProblem ?? undefined}
          onChange={(e) => setDraft({ ...draft, qid: e.target.value.trim() })}
          placeholder="sleep-hours"
        />
        <Input
          label="Section"
          list="quiz-sections"
          value={draft.section}
          onChange={(e) => setDraft({ ...draft, section: e.target.value })}
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
          value={draft.question}
          onChange={(e) => setDraft({ ...draft, question: e.target.value })}
          placeholder="How many hours do you usually sleep?"
        />
        <Input
          label="Helper text"
          hint="optional"
          value={draft.help}
          onChange={(e) => setDraft({ ...draft, help: e.target.value })}
        />
      </div>

      {/* ---------------- Answer type ---------------- */}
      <div className="mt-6">
        <span className="t-micro block mb-3">How the patient answers</span>
        <div role="radiogroup" aria-label="Answer type" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {TYPES.map((t) => {
            const on = draft.type === t.value;
            return (
              <button
                key={t.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setDraft({ ...draft, type: t.value })}
                className="text-left rounded-[var(--radius-md)] border p-4 min-h-[76px] cursor-pointer transition-colors duration-150 flex flex-col gap-1"
                style={{
                  borderColor: on ? "var(--color-primary)" : "var(--color-line-2)",
                  background: on ? "var(--color-primary-soft)" : "var(--color-surface)",
                }}
              >
                <span className="t-body font-semibold" style={{ color: on ? "var(--color-primary-dark)" : "var(--color-ink)" }}>
                  {TYPE_LABEL[t.value]}
                </span>
                <span className="t-small text-[var(--color-ink-3)]">{t.body}</span>
              </button>
            );
          })}
        </div>
        {typeChanged && (
          <p className="t-small text-[var(--color-caution-text)] mt-2">
            {answered} submission{answered === 1 ? " was" : "s were"} answered as {TYPE_LABEL[initialDraft.type].toLowerCase()}.
            Changing the type does not change what they answered.
          </p>
        )}
        <div className="flex gap-6 flex-wrap mt-3">
          <Checkbox label="Optional" checked={draft.optional} onChange={(v) => setDraft({ ...draft, optional: v })} />
          <Checkbox label="Live" checked={draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} />
        </div>
      </div>

      {/* ---------------- Answers to choose from ---------------- */}
      {choice && (
        <div className="mt-6">
          <span className="t-micro block mb-1">Answers · a score of 100 is ideal, 0 is worst</span>
          {draft.type === "multi" && (
            <p className="t-small text-[var(--color-ink-2)] mb-3 max-w-[66ch]">
              Scored as the lowest-scoring answer ticked, so ticking more never makes a result look better. Mark an
              answer like &ldquo;None of these&rdquo; as <span className="font-semibold">only this</span>: ticking it
              clears the others.
            </p>
          )}
          <div className="flex flex-col gap-3">
            {draft.options.map((o, i) => (
              <div
                key={i}
                className={`grid grid-cols-1 gap-3 items-end ${
                  draft.type === "multi" ? "sm:grid-cols-[1fr_110px_auto_auto]" : "sm:grid-cols-[1fr_110px_auto]"
                }`}
              >
                <Input label={i === 0 ? "Answer" : undefined} value={o.label} onChange={(e) => renameOption(i, e.target.value)} />
                <Input
                  label={i === 0 ? "Score" : undefined}
                  type="number"
                  min={0}
                  max={100}
                  mono
                  value={o.score}
                  onChange={(e) => {
                    const options = [...draft.options];
                    options[i] = { ...o, score: Number(e.target.value) };
                    setDraft({ ...draft, options });
                  }}
                />
                {draft.type === "multi" && (
                  <Checkbox
                    label="Only this"
                    checked={o.exclusive}
                    onChange={(v) => {
                      const options = [...draft.options];
                      options[i] = { ...o, exclusive: v };
                      setDraft({ ...draft, options });
                    }}
                  />
                )}
                <Button
                  variant="ghost"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      options: draft.options.filter((_, n) => n !== i),
                      contraindicationIf: draft.contraindicationIf.filter((v) => v !== o.value),
                    })
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
                setDraft({ ...draft, options: [...draft.options, { value: "", label: "", score: 50, exclusive: false }] })
              }
            >
              Add an answer
            </Button>
          </div>
        </div>
      )}

      {/* ---------------- Number settings ---------------- */}
      {draft.type === "number" && (
        <div className="mt-6">
          <span className="t-micro block mb-3">The number</span>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label="Lowest answer"
              hint="optional"
              type="number"
              mono
              value={draft.min}
              onChange={(e) => setDraft({ ...draft, min: e.target.value })}
            />
            <Input
              label="Highest answer"
              hint="optional"
              type="number"
              mono
              value={draft.max}
              onChange={(e) => setDraft({ ...draft, max: e.target.value })}
            />
            <Input
              label="Counted in"
              hint="optional"
              value={draft.unit}
              placeholder="hours, kg, cigarettes"
              onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
            />
          </div>
          <Checkbox
            label="Allow decimals, like 7.5"
            checked={draft.decimals}
            onChange={(v) => setDraft({ ...draft, decimals: v })}
          />
          {numberProblem ? (
            <p className="t-small text-[var(--color-critical-text)]">{numberProblem}</p>
          ) : (
            <p className="t-small text-[var(--color-ink-3)]">
              The patient types a {draft.decimals ? "" : "whole "}number
              {rangeWords(draftToDef(draft)) ? ` ${rangeWords(draftToDef(draft))}` : ""}. Number answers go to the
              physician and are not scored, so they do not move any marker.
            </p>
          )}
        </div>
      )}

      {draft.type === "text" && (
        <p className="t-small text-[var(--color-ink-3)] mt-6 max-w-[66ch]">
          Free-text answers go to the physician and are not scored, so they do not move any marker.
        </p>
      )}

      {/* ---------------- Markers ---------------- */}
      {choice && (
        <div className="mt-6">
          <span className="t-micro block mb-1">Which markers this answer moves</span>
          <p className="t-small text-[var(--color-ink-2)] mb-3 max-w-[62ch]">
            Weight 0 to 1. A marker at 1 takes this answer&apos;s score at full strength; at 0.5 it counts half as
            much as another question feeding the same marker. Leave a marker at 0 and it is not touched.
          </p>
          <div className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2">
            {markers.map((m) => {
              const weight = draft.affects[m] ?? 0;
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
                      const affects = { ...draft.affects };
                      if (v === 0) delete affects[m];
                      else affects[m] = v;
                      setDraft({ ...draft, affects });
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
      )}

      {/* ---------------- Screening ---------------- */}
      {choice && draft.options.length > 0 && (
        <div className="mt-6">
          <span className="t-micro block mb-3">Answers that must stop a booking</span>
          <div className="flex gap-2 flex-wrap">
            {draft.options.map((o, i) => {
              const on = draft.contraindicationIf.includes(o.value);
              return (
                <button
                  key={`${o.value}-${i}`}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      contraindicationIf: on
                        ? draft.contraindicationIf.filter((v) => v !== o.value)
                        : [...draft.contraindicationIf, o.value],
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

      {/* ---------------- Who is asked ---------------- */}
      <RuleBuilder draft={draft} setDraft={setDraft} earlier={earlier} byId={byId} summary={summary} />

      {problems.length > 0 && (
        <Notice tone="critical" className="mt-5">
          <span className="block font-semibold mb-1">This cannot be saved yet</span>
          <ul className="list-disc pl-5 m-0">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </Notice>
      )}

      {error && (
        <Notice tone="critical" className="mt-5">
          {error}
        </Notice>
      )}

      {confirm && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3 mt-5">
          <span className="t-body font-semibold block">{confirm.title}</span>
          <span className="t-body text-[var(--color-ink-2)] block mt-1">{confirm.body}</span>
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button variant="danger" loading={busy} onClick={remove}>
              {confirm.cta}
            </Button>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Keep it
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2 mt-6 flex-wrap">
        <Button size="md" loading={busy} disabled={blocked} onClick={save}>
          Save question
        </Button>
        {!isNew && !confirm && (
          <Button
            variant="destructive"
            onClick={() =>
              setConfirm(
                answered > 0
                  ? {
                      title: `Retire “${initialDraft.question}”?`,
                      body: `${answered} submission${answered === 1 ? " has" : "s have"} answered it, so it is taken out of the quiz rather than deleted — past answers stay readable. You can make it live again later.`,
                      cta: "Retire it",
                    }
                  : {
                      title: `Delete “${initialDraft.question}”?`,
                      body: "Nobody has answered it yet, so it is removed completely. This cannot be undone.",
                      cta: "Delete it",
                    }
              )
            }
          >
            Remove
          </Button>
        )}
      </div>
    </Card>
  );
}

const NOTICE = {
  caution: "border-[var(--color-caution)] bg-[var(--color-caution-soft)]",
  info: "border-[var(--color-info)] bg-[var(--color-info-soft)]",
  critical: "border-[var(--color-critical)] bg-[var(--color-critical-soft)]",
} as const;

function Notice({
  tone,
  className = "mb-5",
  children,
}: {
  tone: keyof typeof NOTICE;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-[var(--radius-md)] border px-4 py-3 ${NOTICE[tone]} ${className}`}>
      <div className="t-body text-[var(--color-ink-2)]">{children}</div>
    </div>
  );
}
