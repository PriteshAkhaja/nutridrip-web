"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A horizontal, snapping row of cards with previous / next buttons.
 *
 * It is a plain overflow scroller underneath, so touch, trackpad, shift-wheel
 * and the keyboard (it takes focus; arrow keys scroll it) all work without
 * this code. The buttons only appear while there is somewhere to go, and each
 * moves by most of a screenful rather than one card, which is what people
 * expect from a pair of arrows.
 *
 * `autoplay` (ms) moves it on by one card at that interval and back to the
 * start after the last. The clock is an invisible CSS animation whose end
 * advances the row, so pausing the animation pauses everything, with no timer
 * to keep in step (and no progress bar: on this site a filling bar is kept for
 * real quantities). It holds while the pointer is over the row or its
 * buttons, while anything in it has keyboard focus, while it is off screen
 * (RevealRoot), and whenever the pause button is on — moving content needs a
 * way to stop it (WCAG 2.2.2). With reduced motion it never moves on its own,
 * and the pause button is not shown.
 *
 * `className` styles the scrolling row itself (gap, column widths via child
 * classes); `controls` places the button pair, default under the row's right.
 */
export function Rail({
  children,
  label,
  className = "",
  controls = "below",
  tone = "light",
  autoplay,
}: {
  children: ReactNode;
  /** Names the region for assistive tech, e.g. "Most booked drips". */
  label: string;
  className?: string;
  controls?: "below" | "none";
  tone?: "light" | "dark";
  /** Move on by a card every this many milliseconds. */
  autoplay?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ atStart: true, atEnd: false });
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState({ pointer: false, focus: false });
  // Bumped to start the bar over: after each move, and after anyone moves the
  // row themselves, so it never jumps straight after a swipe or a click.
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() =>
        setEdges({
          atStart: el.scrollLeft <= 4,
          atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4,
        })
      );
    };
    // Fires once on observe, which covers the first measurement.
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", measure);
      cancelAnimationFrame(raf);
    };
  }, []);

  const go = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.86, behavior: "smooth" });
    setCycle((c) => c + 1);
  };

  /** One card on, or back to the first from the last. */
  const advance = () => {
    const el = ref.current;
    if (!el) return;
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 4) {
      el.scrollTo({ left: 0, behavior: "smooth" });
    } else {
      const first = el.firstElementChild;
      const gap = parseFloat(getComputedStyle(el).columnGap) || 0;
      const step = first ? first.getBoundingClientRect().width + gap : el.clientWidth * 0.86;
      el.scrollBy({ left: step, behavior: "smooth" });
    }
    setCycle((c) => c + 1);
  };

  const scrollable = !(edges.atStart && edges.atEnd);
  const auto = Boolean(autoplay) && scrollable && controls === "below";
  const btn =
    tone === "dark"
      ? "border-white/25 text-white hover:bg-white hover:text-[var(--color-ink)]"
      : "border-[var(--color-line-2)] text-[var(--color-ink)] bg-[var(--color-surface)] hover:bg-[var(--color-ink)] hover:text-white hover:border-[var(--color-ink)]";

  return (
    <div
      className={auto ? "rail-auto" : undefined}
      data-pause-offscreen={auto ? "" : undefined}
      data-held={held.pointer || held.focus || paused ? "" : undefined}
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setHeld((h) => ({ ...h, pointer: true }));
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setHeld((h) => ({ ...h, pointer: false }));
      }}
      // Keyboard focus only: a tap focuses the row too, and should not stop
      // it for good.
      onFocus={(e) => {
        if (e.target instanceof Element && e.target.matches(":focus-visible")) setHeld((h) => ({ ...h, focus: true }));
      }}
      onBlur={(e) => {
        if (!(e.relatedTarget instanceof Node) || !e.currentTarget.contains(e.relatedTarget))
          setHeld((h) => ({ ...h, focus: false }));
      }}
    >
      <div
        ref={ref}
        role="region"
        aria-label={label}
        tabIndex={0}
        className={`rail flex overflow-x-auto focus-visible:outline-offset-4 ${className}`}
        onPointerDown={() => setCycle((c) => c + 1)}
      >
        {children}
      </div>
      {controls === "below" && scrollable ? (
        <div className={`mt-6 flex items-center gap-2 ${auto ? "justify-between" : "justify-end"}`}>
          {auto ? (
            <div className="relative flex items-center motion-reduce:hidden">
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                aria-pressed={paused}
                aria-label={paused ? `Play ${label.toLowerCase()}` : `Pause ${label.toLowerCase()}`}
                className={`w-11 h-11 rounded-full border inline-flex items-center justify-center cursor-pointer transition-colors duration-200 ${btn}`}
              >
                <PlayPause playing={!paused} />
              </button>
              <span
                key={cycle}
                aria-hidden
                className="rail-clock"
                style={{ animationDuration: `${autoplay}ms` }}
                onAnimationEnd={advance}
              />
            </div>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => go(-1)}
              disabled={edges.atStart}
              aria-label="Previous"
              className={`w-11 h-11 rounded-full border inline-flex items-center justify-center cursor-pointer transition-colors duration-200 disabled:opacity-35 disabled:cursor-default disabled:pointer-events-none ${btn}`}
            >
              <Chevron dir="left" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              disabled={edges.atEnd}
              aria-label="Next"
              className={`w-11 h-11 rounded-full border inline-flex items-center justify-center cursor-pointer transition-colors duration-200 disabled:opacity-35 disabled:cursor-default disabled:pointer-events-none ${btn}`}
            >
              <Chevron dir="right" />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden focusable="false">
      <path
        d={dir === "right" ? "M8 5l5 5-5 5" : "M12 5l-5 5 5 5"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlayPause({ playing }: { playing: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden focusable="false">
      {playing ? (
        <>
          <rect x="3" y="2.5" width="2.6" height="9" rx="0.8" />
          <rect x="8.4" y="2.5" width="2.6" height="9" rx="0.8" />
        </>
      ) : (
        <path d="M4.5 2.8v8.4a.6.6 0 0 0 .9.5l6.6-4.2a.6.6 0 0 0 0-1L5.4 2.3a.6.6 0 0 0-.9.5Z" />
      )}
    </svg>
  );
}
