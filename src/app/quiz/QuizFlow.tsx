"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type TouchEvent as ReactTouchEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { LogoMark } from "@/components/layout/Logo";
import type { Answer, Answers, QuizQuestion } from "@/lib/clinical/quiz";
import {
  answerProblem,
  answersForVisible,
  canContinue,
  hasAnswer,
  rangeWords,
  toggleMulti,
  visibleQuestions,
} from "@/lib/clinical/quiz-rules";

/**
 * One question per screen. The progress bar is a Fill measuring answered
 * questions, and it carries its number like every other Fill.
 *
 * Which questions a patient meets depends on their answers: a follow-up is only
 * asked when the answer it follows calls for it. So the list is worked out again
 * from the answers on every change, and the patient's place is held by WHICH
 * question they are on, not by a position in a list that can grow and shrink
 * under them.
 *
 * The sections are steps the patient can tap. A finished section can be opened
 * again to change an answer, and the first unfinished one can be jumped to --
 * but nothing after it: a later section can hold follow-ups that depend on the
 * earlier answers, and Screening must be answered knowing everything before it.
 *
 * Questions sit side by side like cards in a slider: Continue slides the current
 * one out to the left as the next comes in from the right, Back the other way.
 * On a phone the card follows the finger, with the next one showing at its edge.
 */
export function QuizFlow({
  questions,
  preferredDrip,
  retakeNote = null,
}: {
  questions: QuizQuestion[];
  preferredDrip: string | null;
  /** On a retake, what the new answers will do -- said before the first question. */
  retakeNote?: string | null;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Answers>({});
  const [currentId, setCurrentId] = useState<string>(questions[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // A number box shows its problem once the patient has typed, not while it is empty.
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  // Questions the patient has moved on from. An optional question left blank
  // counts as done only once they have seen it -- otherwise a section of
  // optional questions would show as finished before it was ever opened.
  const [passed, setPassed] = useState<Record<string, boolean>>({});
  const stepsRef = useRef<HTMLDivElement>(null);
  // The slider. `leaving` is the question sliding out while the current one
  // slides in; `peer` is the neighbour shown at the edge while a finger drags;
  // `slide` starts one movement (a new object each time, so it always runs).
  const [leaving, setLeaving] = useState<{ id: string } | null>(null);
  const [peer, setPeer] = useState<{ id: string; dir: Dir } | null>(null);
  const [slide, setSlide] = useState<{ dir: Dir; from: number } | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  // The finger, from touch-down to lift-off.
  const drag = useRef<DragState | null>(null);
  const byId = useMemo(() => new Map(questions.map((x) => [x.id, x])), [questions]);

  const visible = useMemo(() => visibleQuestions(questions, answers), [questions, answers]);
  // The current question is always on the list: only answers BEFORE it decide
  // whether it is asked, and the patient is not changing those while here.
  const index = Math.max(0, visible.findIndex((q) => q.id === currentId));
  const q = visible[index];
  const last = index === visible.length - 1;
  const answered = useMemo(() => visible.filter((v) => hasAnswer(answers[v.id])).length, [visible, answers]);

  const steps = useMemo(() => {
    const out: SectionStep[] = [];
    for (const v of visible) {
      let step = out[out.length - 1];
      if (!step || step.name !== v.section) {
        step = { name: v.section, firstId: v.id, resumeId: null, total: 0, done: 0 };
        out.push(step);
      }
      step.total++;
      if (isDone(v, answers, passed)) step.done++;
      else step.resumeId ??= v.id;
    }
    return out;
  }, [visible, answers, passed]);

  // Everything up to and including the first unfinished section can be opened.
  const frontier = steps.findIndex((st) => st.resumeId !== null);
  const reachable = (i: number) => frontier === -1 || i <= frontier;
  const stepIndex = steps.findIndex((st) => st.name === q?.section);

  // Keep the current section's step in view as the patient moves through a
  // row that is wider than a phone.
  useEffect(() => {
    const row = stepsRef.current;
    const el = row?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!row || !el) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    row.scrollTo({ left: el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2, behavior: still ? "auto" : "smooth" });
  }, [stepIndex]);

  // Run a slide: the leaving card out, the current one in, both from where a
  // finger left them (0 for a button). Before paint, so neither flashes in place.
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!slide || !track) return;
    const out = track.querySelector<HTMLElement>('[data-role="leaving"]');
    const inn = track.querySelector<HTMLElement>('[data-role="current"]');
    if (!inn) return;
    const w = track.offsetWidth + SLIDE_GAP;
    const forward = slide.dir === "forward";
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Finishing a drag covers only the distance left, in proportionally less time.
    const duration = still ? 0 : Math.round(SLIDE_MS * Math.max(0.35, 1 - Math.abs(slide.from) / w));
    const timing = { duration, easing: SLIDE_EASE };

    // Whoever had focus in the card that is leaving (Enter in a number box)
    // moves to the new question, rather than being dropped on the page.
    if (out?.contains(document.activeElement)) inn.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });

    inn.style.transform = "";
    const moveIn = inn.animate(
      [{ transform: `translateX(${slide.from + (forward ? w : -w)}px)` }, { transform: "translateX(0)" }],
      timing
    );
    let moveOut: Animation | undefined;
    if (out) {
      out.style.transform = "";
      moveOut = out.animate(
        [{ transform: `translateX(${slide.from}px)` }, { transform: `translateX(${forward ? -w : w}px)` }],
        { ...timing, fill: "forwards" }
      );
    }
    moveIn.onfinish = () => setLeaving(null);
    return () => {
      moveIn.onfinish = null;
      moveIn.cancel();
      moveOut?.cancel();
    };
  }, [slide]);

  // A neighbour brought in by a drag starts just off the edge it will come from.
  useLayoutEffect(() => {
    const el = trackRef.current?.querySelector<HTMLElement>('[data-role="peer"]');
    const w = (trackRef.current?.offsetWidth ?? 0) + SLIDE_GAP;
    if (el && peer) el.style.transform = `translateX(${(drag.current?.dx ?? 0) + (peer.dir === "forward" ? w : -w)}px)`;
  }, [peer]);

  if (!q) return null;

  const canAdvance = canContinue(q, answers[q.id]);

  /**
   * Move to another question, sliding the way the patient is going. `from` is
   * where a finger left the current card, so a swipe finishes from there.
   */
  const goTo = (id: string, dir: Dir, from = 0) => {
    if (id === q.id) return;
    setLeaving({ id: q.id });
    setPeer(null);
    setCurrentId(id);
    setSlide({ dir, from });
    // A long question may have been scrolled; the next one starts at its top.
    if (window.scrollY > 0) window.scrollTo({ top: 0 });
  };

  const next = (from = 0) => {
    if (!canAdvance) return;
    setPassed((p) => ({ ...p, [q.id]: true }));
    if (last) {
      // Reached by walking forward, everything before is answered. Only a jump
      // back and a changed answer can open a new follow-up behind the patient;
      // send them to it rather than submitting without it.
      const gap = visible.find((v) => v.id !== q.id && !isDone(v, answers, passed));
      if (gap) return goTo(gap.id, "back");
      return submit();
    }
    goTo(visible[index + 1].id, "forward", from);
  };

  const back = (from = 0) => {
    if (index > 0) goTo(visible[index - 1].id, "back", from);
  };

  const openSection = (i: number) => {
    const step = steps[i];
    if (!step || !reachable(i)) return;
    // A finished section opens at its start, to review it; an unfinished one
    // where the patient left off.
    const target = step.resumeId ?? step.firstId;
    const at = visible.findIndex((v) => v.id === target);
    goTo(target, at < index ? "back" : "forward");
  };

  /**
   * The finger. The card follows it sideways, and the neighbour in that
   * direction comes into view at its edge; let go past a quarter of the width,
   * or with a quick flick, and it slides the rest of the way -- otherwise it
   * springs back.
   *
   * Where there is nowhere to go -- the question is not answered yet, it is the
   * first, or it is the LAST (the quiz is sent by the button, never by a swipe)
   * -- the card only gives a little and springs back.
   *
   * Only a mostly sideways movement is a swipe: anything else is left to the
   * page as a scroll. One that starts in a text or number box is left alone,
   * where a drag selects text.
   */
  const onTouchStart = (e: ReactTouchEvent) => {
    const el = e.target as HTMLElement;
    if (e.touches.length !== 1 || leaving || el.closest("input, textarea, select")) {
      drag.current = null;
      return;
    }
    const t = e.touches[0];
    drag.current = { x: t.clientX, y: t.clientY, t0: e.timeStamp, dx: 0, axis: null, lastX: t.clientX, lastT: e.timeStamp, v: 0 };
  };

  const onTouchMove = (e: ReactTouchEvent) => {
    const d = drag.current;
    const track = trackRef.current;
    if (!d || !track) return;
    const t = e.touches[0];
    const dx = t.clientX - d.x;
    const dy = t.clientY - d.y;
    if (d.axis === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      d.axis = Math.abs(dx) > Math.abs(dy) * 1.2 ? "x" : "y";
    }
    if (d.axis !== "x") return;

    // Speed over the last move, for telling a flick from a slow drag.
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.v = (t.clientX - d.lastX) / dt;
    d.lastX = t.clientX;
    d.lastT = e.timeStamp;

    const dir: Dir = dx < 0 ? "forward" : "back";
    const target =
      dir === "forward" ? (!last && canAdvance ? visible[index + 1]?.id : undefined) : index > 0 ? visible[index - 1]?.id : undefined;
    const w = track.offsetWidth + SLIDE_GAP;
    // Somewhere to go: follow the finger. Nowhere: give a little, like elastic.
    d.dx = target ? dx : Math.sign(dx) * Math.min(56, Math.abs(dx) * 0.3);
    d.target = target;
    d.dir = dir;

    if (target && (peer?.id !== target || peer.dir !== dir)) setPeer({ id: target, dir });
    if (!target && peer) setPeer(null);

    const cur = track.querySelector<HTMLElement>('[data-role="current"]');
    const nb = track.querySelector<HTMLElement>('[data-role="peer"]');
    if (cur) cur.style.transform = `translateX(${d.dx}px)`;
    if (nb && target) nb.style.transform = `translateX(${d.dx + (dir === "forward" ? w : -w)}px)`;
  };

  const onTouchEnd = (e: ReactTouchEvent) => {
    const d = drag.current;
    drag.current = null;
    const track = trackRef.current;
    if (!d || d.axis !== "x" || !track) return;
    const w = track.offsetWidth + SLIDE_GAP;
    const far = Math.abs(d.dx) > w * 0.25;
    // A flick: fast at the end, or quick and decisive overall.
    const flick =
      (Math.abs(d.v) > 0.5 && Math.sign(d.v) === Math.sign(d.dx)) ||
      (e.timeStamp - d.t0 < 250 && Math.abs(d.dx) > 40);
    if (d.target && (far || flick)) {
      if (d.dir === "forward") next(d.dx);
      else back(d.dx);
      return;
    }
    // Not far enough: back to where it was, and the neighbour back off the edge.
    const cur = track.querySelector<HTMLElement>('[data-role="current"]');
    const nb = track.querySelector<HTMLElement>('[data-role="peer"]');
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timing = { duration: still ? 0 : 220, easing: SLIDE_EASE };
    if (cur) {
      cur.style.transform = "";
      cur.animate([{ transform: `translateX(${d.dx}px)` }, { transform: "translateX(0)" }], timing);
    }
    if (nb && d.dir) {
      const off = d.dir === "forward" ? w : -w;
      nb.animate([{ transform: `translateX(${d.dx + off}px)` }, { transform: `translateX(${off}px)` }], {
        ...timing,
        fill: "forwards",
      }).onfinish = () => setPeer(null);
    } else {
      setPeer(null);
    }
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/quiz", {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Only the answers to questions this patient was asked. The server drops
        // the rest too; sending them would only invite a second opinion.
        body: JSON.stringify({ answers: answersForVisible(questions, answers) }),
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
              <span className="t-micro">
                Section {stepIndex + 1} of {steps.length}
              </span>
            </div>
            <span className="t-data text-[13px] text-[var(--color-ink-2)]">
              {index + 1} / {visible.length}
            </span>
          </div>
          <div className="h-[6px] rounded-full bg-[var(--color-surface-2)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-primary)] transition-all duration-150 ease-out"
              style={{ width: `${((index + 1) / visible.length) * 100}%` }}
            />
          </div>

          {/* On a phone the row scrolls sideways, edge to edge, so a cut-off
              step says there is more. On a wider screen, where a mouse cannot
              swipe, it wraps instead. */}
          <nav aria-label="Quiz sections">
            <div
              ref={stepsRef}
              className="relative flex gap-2 overflow-x-auto -mx-5 px-5 mt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:mx-0 sm:px-0"
            >
              {steps.map((st, i) => {
                const current = i === stepIndex;
                const finished = st.resumeId === null;
                const open = reachable(i);
                return (
                  <button
                    key={st.name}
                    type="button"
                    onClick={() => openSection(i)}
                    disabled={!open}
                    aria-current={current ? "step" : undefined}
                    aria-label={`${st.name}: ${finished ? "finished" : `${st.done} of ${st.total} answered`}${
                      open ? "" : ", answer the sections before it first"
                    }`}
                    className="flex-none inline-flex items-center gap-2 min-h-[40px] px-3 rounded-full border text-[13px] whitespace-nowrap transition-colors duration-150 enabled:cursor-pointer disabled:cursor-not-allowed"
                    style={{
                      borderColor: current ? "var(--color-primary)" : "var(--color-line)",
                      background: current ? "var(--color-primary-soft)" : "var(--color-surface)",
                      color: open ? "var(--color-ink)" : "var(--color-ink-3)",
                      fontWeight: current ? 600 : 500,
                    }}
                  >
                    {finished ? (
                      <svg aria-hidden width="14" height="14" viewBox="0 0 12 12" fill="none" className="flex-none">
                        <path
                          d="M2.5 6.2 5 8.6l4.5-5.2"
                          stroke="var(--color-primary)"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : null}
                    <span>{st.name}</span>
                    {!finished && (
                      <span className="t-data text-[12px]" style={{ color: "var(--color-ink-3)" }}>
                        {st.done}/{st.total}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </header>

      {/* touch-pan-y: sideways finger movements belong to the quiz, not the
          browser. Without it a swipe right was also the browser's "back a
          page" gesture, and the patient left the quiz with their answers. */}
      <main
        className="flex-1 mx-auto w-full max-w-[560px] px-5 py-8 flex flex-col overflow-x-clip touch-pan-y"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        {retakeNote && index === 0 && (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-info)] bg-[var(--color-info-soft)] px-4 py-3 mb-6">
            <span className="t-body font-semibold block">Answering again</span>
            <span className="t-body text-[var(--color-ink-2)]">{retakeNote}</span>
          </div>
        )}
        {/* The slider. Every card sits in the same grid cell, so the track is as
            tall as the tallest and nothing below it jumps; they move sideways by
            transform alone. Only the current card can be used -- the others are
            inert, and hidden from screen readers. */}
        <div ref={trackRef} className="grid">
          {[
            ...(leaving && leaving.id !== q.id ? [{ id: leaving.id, role: "leaving" as const }] : []),
            { id: q.id, role: "current" as const },
            ...(peer && peer.id !== q.id && peer.id !== leaving?.id ? [{ id: peer.id, role: "peer" as const }] : []),
          ].map(({ id, role }) => {
            const card = byId.get(id);
            if (!card) return null;
            const live = role === "current";
            return (
              <div
                key={id}
                data-role={role}
                inert={!live}
                aria-hidden={live ? undefined : true}
                className="[grid-area:1/1] min-w-0"
              >
                <QuestionCard
                  q={card}
                  answer={answers[id]}
                  live={live}
                  showProblem={Boolean(touched[id])}
                  onAnswer={(value) => setAnswers((a) => ({ ...a, [id]: value }))}
                  onTyped={() => setTouched((t) => ({ ...t, [id]: true }))}
                  onEnter={() => next()}
                />
              </div>
            );
          })}
        </div>

        {error && (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3 mt-6">
            <span className="t-body text-[var(--color-ink-2)]">{error}</span>
          </div>
        )}

        <div className="mt-auto pt-8 flex gap-3">
          {index > 0 && (
            <Button variant="secondary" size="lg" onClick={() => back()}>
              Back
            </Button>
          )}
          <Button size="lg" block loading={busy} disabled={!canAdvance} onClick={() => next()}>
            {last ? "See my results" : "Continue"}
          </Button>
        </div>

        <p className="t-small text-[var(--color-ink-3)] mt-4 text-center">
          {answered} of {visible.length} answered · a physician reads every submission
        </p>
      </main>
    </div>
  );
}

type Dir = "forward" | "back";

/** A finger on the slider, from touch-down to lift-off. */
type DragState = {
  x: number;
  y: number;
  /** When the finger touched down. */
  t0: number;
  /** How far the card has been moved: the finger's distance, or less where it only gives. */
  dx: number;
  /** Decided on the first few pixels: sideways is a swipe, anything else a scroll. */
  axis: "x" | "y" | null;
  lastX: number;
  lastT: number;
  /** Speed, px per ms, for telling a flick from a slow drag. */
  v: number;
  target?: string;
  dir?: Dir;
};

/** Cards sit this far apart, so one leaves fully past the edge as the next arrives. */
const SLIDE_GAP = 20;
const SLIDE_MS = 340;
/** Quick to start, long to settle: it lands, it does not bounce. */
const SLIDE_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * One question, as a card in the slider. The current card is live; a card
 * sliding out, or peeking in at the edge during a drag, shows the same thing
 * but cannot be used.
 */
function QuestionCard({
  q,
  answer,
  live,
  showProblem,
  onAnswer,
  onTyped,
  onEnter,
}: {
  q: QuizQuestion;
  answer: Answer | undefined;
  live: boolean;
  showProblem: boolean;
  onAnswer: (value: Answer) => void;
  onTyped: () => void;
  onEnter: () => void;
}) {
  const problem = answerProblem(q, answer);
  const picked = Array.isArray(answer) ? answer : [];
  const range = rangeWords(q);

  return (
    <>
      <h1
        tabIndex={-1}
        className="mb-2 outline-none"
        style={{ font: "600 26px/1.25 var(--font-display)", letterSpacing: "-0.02em", textWrap: "pretty" }}
      >
        {q.question}
      </h1>
      {q.help && <p className="t-body text-[var(--color-ink-2)] mb-6">{q.help}</p>}
      {q.type === "multi" && <p className="t-small text-[var(--color-ink-3)] mb-2">Tick all that apply.</p>}

      <div className="flex flex-col gap-3 mt-4">
        {q.type === "text" ? (
          <Textarea
            label={q.optional ? "Optional" : "Your answer"}
            placeholder={q.optional ? "Leave blank if none" : "Type here"}
            value={typeof answer === "string" ? answer : ""}
            onChange={(e) => onAnswer(e.target.value)}
            rows={3}
          />
        ) : q.type === "number" ? (
          <NumberAnswer
            id={q.id}
            live={live}
            value={typeof answer === "string" ? answer : ""}
            unit={q.unit}
            decimals={q.decimals}
            hint={range ? range[0].toUpperCase() + range.slice(1) : q.optional ? "Optional" : undefined}
            error={showProblem ? problem : null}
            onChange={(v) => {
              onTyped();
              onAnswer(v);
            }}
            onEnter={onEnter}
          />
        ) : (
          q.options?.map((o) => {
            const selected = q.type === "multi" ? picked.includes(o.value) : answer === o.value;
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={selected}
                onClick={() => onAnswer(q.type === "multi" ? toggleMulti(q, picked, o.value) : o.value)}
                className="text-left min-h-[56px] px-5 rounded-[var(--radius-md)] border cursor-pointer flex items-center gap-4 transition-colors duration-150"
                style={{
                  borderColor: selected ? "var(--color-primary)" : "var(--color-line)",
                  background: selected ? "var(--color-primary-soft)" : "var(--color-surface)",
                }}
              >
                {q.type === "multi" ? (
                  // A square that takes a tick: many may be chosen. The round
                  // marker below means one -- the shape says which before a tap.
                  <span
                    aria-hidden
                    className="w-[18px] h-[18px] rounded-[4px] flex-none inline-flex items-center justify-center"
                    style={{
                      border: selected ? "none" : "1.5px solid var(--color-line-2)",
                      background: selected ? "var(--color-primary)" : "var(--color-surface)",
                    }}
                  >
                    {selected && (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2.5 6.2 5 8.6l4.5-5.2" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                ) : (
                  <span
                    className="w-[18px] h-[18px] rounded-full flex-none"
                    style={{
                      border: selected ? "6px solid var(--color-primary)" : "1.5px solid var(--color-line-2)",
                      background: "var(--color-surface)",
                    }}
                  />
                )}
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
    </>
  );
}

/** One section of the quiz, as a step in the header. */
type SectionStep = {
  name: string;
  firstId: string;
  /** The first question not yet done; null when the whole section is. */
  resumeId: string | null;
  total: number;
  done: number;
};

/**
 * A question is done when it is answered, or -- if it may be left blank --
 * when the patient has seen it and moved on.
 */
function isDone(q: QuizQuestion, answers: Answers, passed: Record<string, boolean>): boolean {
  return canContinue(q, answers[q.id]) && (hasAnswer(answers[q.id]) || Boolean(passed[q.id]));
}

/**
 * A number, with its unit beside it rather than inside the label: "7" and
 * "hours" are read together, as they would be said.
 */
function NumberAnswer({
  id,
  live,
  value,
  unit,
  decimals,
  hint,
  error,
  onChange,
  onEnter,
}: {
  /** The question's id, so two cards on screen never share the hint's id. */
  id: string;
  /** Only the current card takes focus -- not one peeking in during a drag. */
  live: boolean;
  value: string;
  unit?: string;
  decimals?: boolean;
  hint?: string;
  error: string | null;
  onChange: (value: string) => void;
  onEnter: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <input
          type="number"
          inputMode={decimals ? "decimal" : "numeric"}
          step={decimals ? "any" : 1}
          autoFocus={live}
          value={value}
          aria-label="Your answer"
          aria-invalid={error ? true : undefined}
          aria-describedby={`number-hint-${id}`}
          onChange={(e) => onChange(e.target.value)}
          // A number box changes its value when the page is scrolled over it --
          // hand the scroll back to the page instead.
          onWheel={(e) => e.currentTarget.blur()}
          onKeyDown={(e) => {
            if (e.key === "Enter") onEnter();
          }}
          className="w-[160px] min-h-[56px] px-4 rounded-[var(--radius-md)] border bg-[var(--color-surface)] t-data text-[20px] tabular-nums"
          style={{ borderColor: error ? "var(--color-critical)" : "var(--color-line-2)" }}
        />
        {unit && <span className="t-body text-[var(--color-ink-2)]">{unit}</span>}
      </div>
      <span id={`number-hint-${id}`} className="t-small" style={{ color: error ? "var(--color-critical-text)" : "var(--color-ink-3)" }}>
        {error ?? hint ?? ""}
      </span>
    </div>
  );
}
