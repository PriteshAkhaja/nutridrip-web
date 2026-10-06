"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import type { Step } from "./StickySteps";
import { thread } from "./scroll/effects";

/**
 * StickySteps with a thread: the /how-it-works version (approved prototype in
 * scrollcraft/builds/how-it-works). The numbered circles sit in a gutter and a
 * thread draws down through them as you read; the sticky picture
 * cross-dissolves in step with it (scroll/effects.ts, "thread"). The home page
 * keeps the plain StickySteps.
 *
 * Under reduced motion there is no thread: the picture changes when a step
 * crosses the middle of the screen, as in StickySteps. On a phone each step
 * carries its own picture above it, as there.
 */
const reducedQuery = "(prefers-reduced-motion: reduce)";
function subscribe(cb: () => void) {
  const m = matchMedia(reducedQuery);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}

export function ThreadSteps({ steps, media }: { steps: Step[]; media: ReactNode[] }) {
  const root = useRef<HTMLDivElement>(null);
  const items = useRef<Array<HTMLLIElement | null>>([]);
  const [active, setActive] = useState(0);
  // The thread runs unless the visitor asks for reduced motion (and never in
  // the server render, which is the plain version until the script runs).
  const live = !useSyncExternalStore(
    subscribe,
    () => matchMedia(reducedQuery).matches,
    () => true
  );

  useEffect(() => {
    if (!root.current) return;
    if (live) return thread(root.current);
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index ?? 0));
      },
      { rootMargin: "-46% 0px -46% 0px", threshold: 0 }
    );
    for (const el of items.current) if (el) io.observe(el);
    return () => io.disconnect();
  }, [live]);

  return (
    <div ref={root} className="group/root grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
      <div className="hidden lg:block">
        <div className="sticky top-[calc(var(--site-header-h)+48px)]">
          <div className="relative aspect-[4/4.6] overflow-hidden rounded-[var(--radius-2xl)] bg-[var(--color-surface-2)]">
            {media.map((m, i) => (
              <div
                key={i}
                data-st-pic
                aria-hidden={i !== active}
                className={`absolute inset-0 ${
                  live
                    ? i === 0
                      ? "opacity-100"
                      : "opacity-0"
                    : `transition-[opacity,transform] duration-700 ease-[var(--ease-glide)] ${
                        i === active ? "opacity-100 scale-100" : "opacity-0 scale-[1.03]"
                      }`
                }`}
              >
                {m}
              </div>
            ))}
          </div>
          <div className="mt-5 flex gap-2" aria-hidden>
            {steps.map((s, i) => (
              <span
                key={s.title}
                data-st-bar
                data-on={i <= active ? "1" : "0"}
                className="h-[3px] flex-1 rounded-full bg-[var(--color-line)] transition-colors duration-500 data-[on=1]:bg-[var(--color-primary)]"
              />
            ))}
          </div>
        </div>
      </div>

      <ol data-st-list className="relative list-none m-0 p-0">
        {/* The thread: placed and drawn by the script, between the first circle and the last. */}
        <span
          data-st-thread
          aria-hidden
          className="pointer-events-none absolute hidden w-[1.5px] bg-[var(--color-line)] group-data-[live]/root:block"
        >
          <i
            data-st-thread-ink
            className="absolute inset-0 origin-top bg-[var(--color-primary)]"
            // A transform, not Tailwind's scale-y-0: that is the separate `scale` property and
            // would multiply with the transform the script writes.
            style={{ transform: "scaleY(0)" }}
          />
        </span>
        {steps.map((s, i) => (
          <li
            key={s.title}
            ref={(el) => {
              items.current[i] = el;
            }}
            data-st-item
            data-index={i}
            data-state={!live && i === active ? "current" : undefined}
            // Each divider starts where the text does, clear of the thread.
            className="group/st relative flex flex-col justify-center py-10 pl-14 first:pt-0 lg:min-h-[56vh] lg:py-14 lg:pl-[68px] lg:first:pt-14 not-first:before:absolute not-first:before:top-0 not-first:before:right-0 not-first:before:left-14 not-first:before:h-px not-first:before:bg-[var(--color-line)] not-first:before:content-[''] lg:not-first:before:left-[68px]"
          >
            <div className="relative mb-7 aspect-[4/5] overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-surface-2)] sm:aspect-[4/3.4] lg:hidden">
              <div className="absolute inset-0">{media[i]}</div>
            </div>
            <div className="relative flex min-h-9 items-center gap-3">
              <span
                data-st-dot
                className="t-data absolute top-0 -left-14 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-line-2)] bg-[var(--color-surface)] text-[13px] text-[var(--color-ink-2)] transition-colors duration-500 lg:-left-[68px] group-data-[state=current]/st:border-[var(--color-primary)] group-data-[state=current]/st:bg-[var(--color-primary)] group-data-[state=current]/st:text-white group-data-[state=done]/st:border-[var(--color-primary)] group-data-[state=done]/st:text-[var(--color-primary-text)]"
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="t-micro">{s.kicker}</span>
            </div>
            <h3
              className="mt-5 transition-colors duration-500 lg:text-[var(--color-ink-3)] lg:group-data-[state=current]/st:text-[var(--color-ink)]"
              style={{ font: "600 clamp(26px, 2.6vw, 36px)/1.12 var(--font-display)", letterSpacing: "-0.03em" }}
            >
              {s.title}
            </h3>
            <p className="t-lead mt-4 max-w-[48ch]">{s.body}</p>
            {s.note ? (
              <p className="t-small mt-5 max-w-[52ch] border-l-2 border-[var(--color-primary-line)] pl-4 text-[var(--color-ink-2)]">
                {s.note}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
