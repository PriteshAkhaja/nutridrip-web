"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import { FillBar } from "@/components/ui/Fill";
import { GripIcon, Sortable } from "@/components/ui/Sortable";
import type { QuizQuestion } from "@/lib/clinical/quiz";
import { dependentsOf, describeShowIf, newProblems } from "@/lib/clinical/quiz-rules";
import { QuestionForm } from "./QuestionForm";
import { TYPE_LABEL } from "./RuleBuilder";
import { blankDraft, toDraft, type Draft } from "./draft";

type Status = { section: string; tone: "quiet" | "error"; text: string } | null;

/**
 * The questionnaire, as the admin arranges it.
 *
 * Questions are put in order by dragging their handle (or from the keyboard),
 * within their section. The new order shows at once and is saved in one
 * request; a move that would put a follow-up before the question it follows is
 * refused on the spot with the reason, and the row goes back where it was.
 */
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
  const [editing, setEditing] = useState<{ draft: Draft; isNew: boolean } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);
  const [confirmRestore, setConfirmRestore] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  // The order on screen before the server has confirmed it. Tied to the list it
  // was made from: once fresh data arrives, the server's order is the truth.
  const [local, setLocal] = useState<{ base: QuizQuestion[]; ids: string[] } | null>(null);
  const pendingSave = useRef<ReturnType<typeof setTimeout> | null>(null);

  const byId = new Map(initial.map((q) => [q.id, q]));
  const ids = local && local.base === initial ? local.ids : initial.map((q) => q.id);
  const ordered = ids.map((id) => byId.get(id)).filter((q): q is QuizQuestion => Boolean(q));
  const sections = [...new Set(ordered.map((q) => q.section))];

  const saveOrder = async (section: string, qids: string[]) => {
    setStatus({ section, tone: "quiet", text: "Saving the new order…" });
    try {
      const res = await fetch("/api/admin/quiz/order", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ qids }),
      });
      const json = await res.json();
      if (!json.success) {
        setLocal(null);
        setStatus({ section, tone: "error", text: json.error ?? "The new order was not saved." });
      } else {
        setStatus({ section, tone: "quiet", text: "Order saved. The next patient gets it in this order." });
        router.refresh();
      }
    } catch {
      setLocal(null);
      setStatus({ section, tone: "error", text: "Could not reach the server. The order was put back." });
    }
  };

  const reorder = (section: string, next: QuizQuestion[], keyboard: boolean) => {
    const nextIds = sections.flatMap((s) =>
      s === section ? next.map((q) => q.id) : ordered.filter((q) => q.section === s).map((q) => q.id)
    );
    // Refused here, before anything moves, if it would break a rule.
    const broken = newProblems(ordered, nextIds.map((id) => byId.get(id)!));
    if (broken.length) {
      setStatus({ section, tone: "error", text: broken[0] });
      return;
    }
    setLocal({ base: initial, ids: nextIds });
    if (pendingSave.current) clearTimeout(pendingSave.current);
    // Arrow keys move one place per press: wait for the last press, then save once.
    if (keyboard) {
      setStatus({ section, tone: "quiet", text: "Moved. Saving when you stop…" });
      pendingSave.current = setTimeout(() => saveOrder(section, nextIds), 700);
    } else {
      saveOrder(section, nextIds);
    }
  };

  const restore = async () => {
    setRestoring(true);
    setRestoreError(null);
    try {
      const res = await fetch("/api/admin/quiz", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
      const json = await res.json();
      if (!json.success) setRestoreError(json.error ?? "Could not restore the defaults.");
      else {
        setConfirmRestore(false);
        setNote(`Restored the original ${json.data.questions} questions.`);
        router.refresh();
      }
    } catch {
      setRestoreError("Could not reach the server. Nothing changed.");
    } finally {
      setRestoring(false);
    }
  };

  /* ---------------- Editor ---------------- */
  if (editing) {
    return (
      <QuestionForm
        key={editing.draft.qid || "new"}
        initialDraft={editing.draft}
        isNew={editing.isNew}
        questions={ordered}
        markers={markers}
        answered={answeredByQid[editing.draft.qid] ?? 0}
        onCancel={() => setEditing(null)}
        onDone={(message) => {
          setEditing(null);
          setNote(message);
          router.refresh();
        }}
      />
    );
  }

  /* ---------------- List ---------------- */
  const live = ordered.filter((q) => q.isActive !== false);

  return (
    <div>
      {note && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-info)] bg-[var(--color-info-soft)] px-4 py-3 mb-5">
          <span className="t-body text-[var(--color-ink-2)]">{note}</span>
        </div>
      )}

      <div className="flex gap-2 mb-3 flex-wrap">
        <Button
          onClick={() => {
            setNote(null);
            setEditing({ draft: blankDraft(sections[0]), isNew: true });
          }}
        >
          Add a question
        </Button>
        <Button variant="secondary" onClick={() => setConfirmRestore(true)} disabled={confirmRestore}>
          Restore the default set
        </Button>
      </div>

      {confirmRestore && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3 mb-5">
          <span className="t-body font-semibold block">Replace the whole questionnaire with the original questions?</span>
          <span className="t-body text-[var(--color-ink-2)] block mt-1">
            Every question you have added or changed — with its answers, follow-up rules and order — is replaced by
            the original 21. Past submissions keep what patients answered. This cannot be undone.
          </span>
          {restoreError && <span className="t-body text-[var(--color-critical-text)] block mt-2">{restoreError}</span>}
          <div className="flex gap-2 mt-3 flex-wrap">
            <Button variant="danger" loading={restoring} onClick={restore}>
              Restore the defaults
            </Button>
            <Button variant="ghost" onClick={() => setConfirmRestore(false)}>
              Keep my questions
            </Button>
          </div>
        </div>
      )}

      <p className="t-small text-[var(--color-ink-3)] mb-6 max-w-[70ch]">
        Drag a question by its handle to change the order within its section, or focus the handle and use the up and
        down arrow keys. To move a question to another section, open it and change its section.
      </p>

      <div className="flex flex-col gap-8">
        {sections.map((section) => {
          const inSection = ordered.filter((q) => q.section === section);
          const sectionStatus = status?.section === section ? status : null;
          return (
            <section key={section}>
              <div className="flex items-baseline justify-between gap-4 mb-3 flex-wrap">
                <h2 className="t-h3">{section}</h2>
                <span className="t-data text-[13px] text-[var(--color-ink-3)]">
                  {inSection.length} question{inSection.length === 1 ? "" : "s"}
                </span>
              </div>
              <p
                aria-live="polite"
                // Takes no room until it has something to say; the region itself is always
                // there, so a screen reader hears the message when it arrives.
                className="t-small mb-2 empty:mb-0"
                style={{ color: sectionStatus?.tone === "error" ? "var(--color-critical-text)" : "var(--color-ink-3)" }}
              >
                {sectionStatus?.text ?? ""}
              </p>

              <Sortable
                items={inSection}
                idOf={(q) => q.id}
                nameOf={(q) => `“${q.question}”`}
                onReorder={(next, moved) => reorder(section, next, moved.keyboard)}
              >
                {(q, handle, { lifted, dragging }) => {
                  const answered = answeredByQid[q.id] ?? 0;
                  const weights = Object.entries(q.affects ?? {}).filter(([, v]) => (v ?? 0) > 0);
                  const rule = describeShowIf(q, byId);
                  const followers = dependentsOf(q.id, live).length;
                  const retired = q.isActive === false;
                  return (
                    <div
                      className="flex rounded-[var(--radius-lg)] border bg-[var(--color-surface)] transition-shadow duration-150"
                      style={{
                        borderColor: lifted ? "var(--color-primary-line)" : "var(--color-line)",
                        boxShadow: lifted ? "var(--shadow-modal)" : undefined,
                      }}
                    >
                      <button
                        type="button"
                        {...handle}
                        className="flex-none w-11 flex items-center justify-center rounded-l-[var(--radius-lg)] border-r border-[var(--color-line)] text-[var(--color-ink-3)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-2)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-primary)]"
                      >
                        <GripIcon />
                      </button>
                      <button
                        type="button"
                        // A drag that ends over the row must not also open it.
                        onClick={() => {
                          if (dragging) return;
                          setNote(null);
                          setEditing({ draft: toDraft(q), isNew: false });
                        }}
                        className={`flex-1 min-w-0 text-left p-5 cursor-pointer rounded-r-[var(--radius-lg)] hover:bg-[var(--color-surface-2)] transition-colors duration-150 ${
                          retired ? "opacity-60" : ""
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="t-data text-[13px] text-[var(--color-ink-3)]">{q.id}</span>
                              {q.type !== "single" && <Pill tone="neutral">{TYPE_LABEL[q.type]}</Pill>}
                              {q.optional && <Pill tone="neutral">Optional</Pill>}
                              {retired && <Pill tone="neutral">Not live</Pill>}
                              {(q.contraindicationIf ?? []).length > 0 && (
                                <Pill tone="critical" dot>
                                  Screening
                                </Pill>
                              )}
                              {answered > 0 && (
                                <span className="t-small text-[var(--color-ink-3)]">{answered} answered</span>
                              )}
                            </div>
                            <p className="t-body font-medium mt-1">{q.question}</p>
                            {q.options && q.options.length > 0 && (
                              <p className="t-small text-[var(--color-ink-3)] mt-1">
                                {q.options.map((o) => `${o.label} (${o.score})`).join(" · ")}
                              </p>
                            )}
                            {q.type === "number" && (typeof q.min === "number" || typeof q.max === "number" || q.unit) && (
                              <p className="t-small text-[var(--color-ink-3)] mt-1">
                                {[typeof q.min === "number" ? `from ${q.min}` : null, typeof q.max === "number" ? `to ${q.max}` : null, q.unit]
                                  .filter(Boolean)
                                  .join(" ")}
                              </p>
                            )}
                            {rule && (
                              <p className="t-small text-[var(--color-ink-2)] mt-2 flex gap-2">
                                <span aria-hidden className="text-[var(--color-ink-3)]">
                                  ↳
                                </span>
                                <span>{rule}</span>
                              </p>
                            )}
                            {followers > 0 && (
                              <p className="t-small text-[var(--color-ink-3)] mt-1">
                                Decides whether {followers === 1 ? "1 question is" : `${followers} questions are`} asked
                              </p>
                            )}
                          </div>

                          {weights.length > 0 && (
                            <div className="w-full sm:w-[220px] flex-none flex flex-col gap-2">
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
                                <span className="t-small text-[var(--color-ink-3)]">+{weights.length - 3} more</span>
                              )}
                            </div>
                          )}
                        </div>
                      </button>
                    </div>
                  );
                }}
              </Sortable>
            </section>
          );
        })}
      </div>
    </div>
  );
}
