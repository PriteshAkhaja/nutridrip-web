"use client";

import { Button } from "@/components/ui/Button";
import { Input, Select } from "@/components/ui/Field";
import { SelectMenu } from "@/components/ui/SelectMenu";
import type { CondOp, QuizQuestion, QuizType } from "@/lib/clinical/quiz";
import { OPS_FOR_TYPE, isNumericOp, opLabel } from "@/lib/clinical/quiz-rules";
import type { Draft, DraftCondition } from "./draft";

export const TYPE_LABEL: Record<QuizType, string> = {
  single: "Single choice",
  multi: "Multiple choice",
  number: "Number",
  text: "Free text",
};

/** Ten is plenty: a question with more conditions than that is several questions. */
const MAX_CONDITIONS = 10;

/**
 * "Who is asked this question?" -- everybody, or only patients whose earlier
 * answers call for it.
 *
 * A condition can only look at a question asked BEFORE this one, and only the
 * comparisons that make sense for that question's type are offered: "is" for a
 * choice, "is more than" for a number, "has been answered" for free text.
 */
export function RuleBuilder({
  draft,
  setDraft,
  earlier,
  byId,
  summary,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  /** Live questions asked before this one, in the order a patient meets them. */
  earlier: QuizQuestion[];
  byId: Map<string, QuizQuestion>;
  /** The rule as one sentence, or null. */
  summary: string | null;
}) {
  const rule = draft.showIf;
  const conditions = rule?.conditions ?? [];

  const setConditions = (next: DraftCondition[], match = rule?.match ?? "all") =>
    setDraft({ ...draft, showIf: next.length ? { match, conditions: next } : null });

  const freshCondition = (ref: QuizQuestion | undefined): DraftCondition => ({
    qid: ref?.id ?? "",
    op: ref ? OPS_FOR_TYPE[ref.type][0] : "is",
    values: [],
    value: "",
  });

  const setCondition = (i: number, patch: Partial<DraftCondition>) =>
    setConditions(conditions.map((c, n) => (n === i ? { ...c, ...patch } : c)));

  // The nearest earlier question is the likeliest one to follow.
  const nearest = earlier[earlier.length - 1];

  return (
    <div className="mt-6">
      <span className="t-micro block mb-1">Who is asked this question</span>
      <p className="t-small text-[var(--color-ink-2)] mb-3 max-w-[62ch]">
        A follow-up can be asked only when an earlier answer calls for it — &ldquo;How many a day?&rdquo; only for
        patients who said they smoke.
      </p>

      <div
        role="radiogroup"
        aria-label="Who is asked this question"
        className="inline-flex gap-1 p-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] border border-[var(--color-line)] mb-4"
      >
        {[
          { on: !rule, label: "Everyone", pick: () => setDraft({ ...draft, showIf: null }) },
          {
            on: Boolean(rule),
            label: "Only some patients",
            pick: () => {
              if (!rule) setConditions([freshCondition(nearest)]);
            },
          },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={o.on}
            onClick={o.pick}
            className={`px-4 min-h-[40px] rounded-[6px] text-[13px] font-semibold cursor-pointer ${
              o.on ? "bg-[var(--color-surface)] text-[var(--color-ink)]" : "text-[var(--color-ink-2)]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {rule && earlier.length === 0 && (
        <p className="t-body text-[var(--color-ink-2)] max-w-[62ch]">
          Nothing is asked before this question, so there is nothing for it to depend on. Move it later in the
          questionnaire, or add the question it should follow first.
        </p>
      )}

      {rule && earlier.length > 0 && (
        <div className="flex flex-col gap-3">
          {conditions.length > 1 ? (
            <div className="w-full sm:w-[320px]">
              <Select
                label="Ask it when"
                value={rule.match}
                onChange={(e) => setConditions(conditions, e.target.value === "any" ? "any" : "all")}
              >
                <option value="all">All of these are true</option>
                <option value="any">Any one of these is true</option>
              </Select>
            </div>
          ) : (
            <span className="t-small text-[var(--color-ink-2)]">Ask it only when:</span>
          )}

          {conditions.map((c, i) => (
            <ConditionRow
              key={i}
              index={i}
              condition={c}
              earlier={earlier}
              byId={byId}
              onChange={(patch) => setCondition(i, patch)}
              onPickQuestion={(qid) => setCondition(i, freshCondition(byId.get(qid)))}
              onRemove={() => setConditions(conditions.filter((_, n) => n !== i))}
            />
          ))}

          {conditions.length < MAX_CONDITIONS && (
            <div>
              <Button variant="secondary" size="sm" onClick={() => setConditions([...conditions, freshCondition(nearest)])}>
                Add a condition
              </Button>
            </div>
          )}

          {summary && (
            <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-3">
              <span className="t-small text-[var(--color-ink-3)] block mb-1">What patients get</span>
              <span className="t-body">{summary}</span>
              <span className="t-small text-[var(--color-ink-3)] block mt-1">
                A patient who skipped the earlier question is not asked this one.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConditionRow({
  index,
  condition: c,
  earlier,
  byId,
  onChange,
  onPickQuestion,
  onRemove,
}: {
  index: number;
  condition: DraftCondition;
  earlier: QuizQuestion[];
  byId: Map<string, QuizQuestion>;
  onChange: (patch: Partial<DraftCondition>) => void;
  onPickQuestion: (qid: string) => void;
  onRemove: () => void;
}) {
  const ref = byId.get(c.qid);
  const isEarlier = earlier.some((q) => q.id === c.qid);

  // A rule written earlier may point at a question that is now AFTER this one
  // (it was moved). It stays on the list, marked, so the admin can see what is
  // wrong instead of the menu quietly showing a different question.
  const choices = [
    ...earlier.map((q) => ({ value: q.id, label: q.question, detail: [q.section, TYPE_LABEL[q.type]] })),
    ...(ref && !isEarlier
      ? [{ value: ref.id, label: ref.question, detail: ["asked after this question — pick an earlier one"], warn: true }]
      : []),
  ];

  const toggleValue = (v: string) =>
    onChange({ values: c.values.includes(v) ? c.values.filter((x) => x !== v) : [...c.values, v] });

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line-2)] bg-[var(--color-surface)] p-4 flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="t-micro">Condition {index + 1}</span>
        <Button variant="ghost" size="sm" onClick={onRemove}>
          Remove
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <SelectMenu label="Earlier question" value={c.qid} onChange={onPickQuestion} options={choices} />
        {ref && (
          <Select label="Comparison" value={c.op} onChange={(e) => onChange({ op: e.target.value as CondOp })}>
            {OPS_FOR_TYPE[ref.type].map((op) => (
              <option key={op} value={op}>
                {opLabel(ref.type, op)}
              </option>
            ))}
          </Select>
        )}
      </div>

      {ref && (c.op === "is" || c.op === "isNot") && (
        <div>
          <span className="t-micro block mb-2">
            {c.op === "is" ? "Any of these answers" : "None of these answers"}
          </span>
          <div className="flex gap-2 flex-wrap">
            {(ref.options ?? []).map((o) => {
              const on = c.values.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleValue(o.value)}
                  className="min-h-[40px] px-4 rounded-full border cursor-pointer text-[14px]"
                  style={{
                    borderColor: on ? "var(--color-primary)" : "var(--color-line-2)",
                    background: on ? "var(--color-primary-soft)" : "var(--color-surface)",
                    color: on ? "var(--color-primary-dark)" : "var(--color-ink)",
                    fontWeight: on ? 600 : 400,
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {ref && isNumericOp(c.op) && (
        <div className="flex items-end gap-3">
          <div className="w-[160px]">
            <Input
              label="Number"
              type="number"
              mono
              value={c.value}
              onChange={(e) => onChange({ value: e.target.value })}
            />
          </div>
          {ref.unit && <span className="t-body text-[var(--color-ink-2)] pb-[12px]">{ref.unit}</span>}
        </div>
      )}
    </div>
  );
}
