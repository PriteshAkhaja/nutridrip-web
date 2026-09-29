"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type Step = { kicker: string; title: string; body: string; note?: string };

/**
 * Scroll storytelling. On a wide screen the picture holds still in one column
 * while the steps pass in the other, and the picture changes to match whichever
 * step is at the middle of the screen. On a phone each step simply carries its
 * own picture above it.
 *
 * The pictures arrive as server-rendered nodes (`media[i]` belongs to
 * `steps[i]`). Only the active one is visible; the rest are aria-hidden.
 */
export function StickySteps({ steps, media }: { steps: Step[]; media: ReactNode[] }) {
  const [active, setActive] = useState(0);
  const items = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index ?? 0));
        }
      },
      // A thin band across the middle of the screen: whichever step crosses
      // it is the one being read.
      { rootMargin: "-46% 0px -46% 0px", threshold: 0 }
    );
    for (const el of items.current) if (el) io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-20">
      <div className="hidden lg:block">
        <div className="sticky top-[calc(var(--site-header-h)+48px)]">
          <div className="relative aspect-[4/4.6] overflow-hidden rounded-[var(--radius-2xl)] bg-[var(--color-surface-2)]">
            {media.map((m, i) => (
              <div
                key={i}
                aria-hidden={i !== active}
                className={`absolute inset-0 transition-[opacity,transform] duration-700 ease-[var(--ease-glide)] ${
                  i === active ? "opacity-100 scale-100" : "opacity-0 scale-[1.03]"
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
                className="h-[3px] flex-1 rounded-full transition-colors duration-500"
                style={{ background: i <= active ? "var(--color-primary)" : "var(--color-line)" }}
              />
            ))}
          </div>
        </div>
      </div>

      <ol className="list-none m-0 p-0">
        {steps.map((s, i) => (
          <li
            key={s.title}
            ref={(el) => {
              items.current[i] = el;
            }}
            data-index={i}
            className="flex flex-col justify-center border-t border-[var(--color-line)] py-10 first:border-t-0 first:pt-0 lg:min-h-[56vh] lg:py-14 lg:first:pt-14"
          >
            <div className="relative mb-7 aspect-[4/5] overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-surface-2)] sm:aspect-[4/3.4] lg:hidden">
              <div className="absolute inset-0">{media[i]}</div>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`t-data inline-flex h-9 w-9 items-center justify-center rounded-full border text-[13px] transition-colors duration-500 ${
                  i === active
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                    : "border-[var(--color-line-2)] text-[var(--color-ink-2)]"
                }`}
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="t-micro">{s.kicker}</span>
            </div>
            <h3
              className={`mt-5 transition-colors duration-500 ${i === active ? "" : "lg:text-[var(--color-ink-3)]"}`}
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
