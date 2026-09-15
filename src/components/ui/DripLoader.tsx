"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The design system's one rule is that a Fill always encodes a real quantity.
 * So the loader is that primitive at page scale: the bag drains as the
 * wordmark fills, and the counter carries the actual number.
 *
 * The page is already in the DOM underneath, which matters for search engines
 * and means nothing has to be re-fetched when the loader goes. It does cover
 * the viewport while it runs, so it is deliberately brief, shown once per
 * browser session, and announced once rather than on every frame — a counter
 * updating 60 times a second inside a live region is unusable with a screen
 * reader.
 */

const LETTERS = "NUTRIDRIP";

export function DripLoader({
  durationMs = 1500,
  label = "Preparing",
  onDone,
}: {
  durationMs?: number;
  label?: string;
  onDone?: () => void;
}) {
  const [pct, setPct] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const frame = useRef<number>(0);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Reduced motion still gets the brand moment, just without the theatre.
    const total = reduced.current ? 380 : durationMs;
    const start = performance.now();

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / total);
      // Ease so the last few percent do not crawl.
      setPct(Math.round((1 - Math.pow(1 - t, 2.2)) * 100));
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else {
        setLeaving(true);
        window.setTimeout(() => onDone?.(), 420);
      }
    };

    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [durationMs, onDone]);

  /** The bag empties as the wordmark fills — one quantity, two readings. */
  const remaining = 100 - pct;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-white"
      style={{
        transition: "opacity 400ms ease-out, visibility 400ms",
        opacity: leaving ? 0 : 1,
        visibility: leaving ? "hidden" : "visible",
      }}
      role="status"
      aria-live="off"
      aria-label={label}
    >
      <div className="flex flex-col items-center gap-9 px-6">
        {/* ---------------- The bag, the line, the drop ---------------- */}
        <div className="relative flex flex-col items-center" aria-hidden>
          <svg width="96" height="188" viewBox="0 0 96 188" fill="none">
            <defs>
              <clipPath id="ndBagClip">
                <path d="M20 10h56a6 6 0 0 1 6 6v78a26 26 0 0 1-26 26H40a26 26 0 0 1-26-26V16a6 6 0 0 1 6-6Z" />
              </clipPath>
            </defs>

            {/* Fluid — drops as the load completes */}
            <g clipPath="url(#ndBagClip)">
              <rect x="0" y="0" width="96" height="120" fill="var(--color-loader-soft)" />
              <rect
                x="0"
                width="96"
                fill="var(--color-loader)"
                y={120 - (remaining / 100) * 120}
                height={(remaining / 100) * 120}
                style={{ transition: "y 90ms linear, height 90ms linear" }}
              />
            </g>

            {/* Bag outline and its graduation marks */}
            <path
              d="M20 10h56a6 6 0 0 1 6 6v78a26 26 0 0 1-26 26H40a26 26 0 0 1-26-26V16a6 6 0 0 1 6-6Z"
              stroke="var(--color-ink)"
              strokeWidth="2.5"
            />
            <path d="M40 4h16" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round" />
            {[38, 62, 86].map((y) => (
              <path key={y} d={`M68 ${y}h10`} stroke="var(--color-ink)" strokeWidth="1.5" opacity="0.35" />
            ))}

            {/* Drip chamber and line */}
            <path d="M48 120v10" stroke="var(--color-ink)" strokeWidth="2.5" />
            <rect
              x="40"
              y="130"
              width="16"
              height="26"
              rx="6"
              stroke="var(--color-ink)"
              strokeWidth="2.5"
              fill="white"
            />
            <path d="M48 156v30" stroke="var(--color-ink)" strokeWidth="2.5" strokeLinecap="round" />

            {/* The drop itself, falling through the chamber */}
            <circle
              cx="48"
              cy="137"
              r="3.4"
              fill="var(--color-loader)"
              style={{
                transformOrigin: "48px 137px",
                animation: "ndDropFall 1.05s cubic-bezier(.55,0,.85,.5) infinite",
                ["--nd-drop-distance" as string]: "14px",
              }}
            />
          </svg>

          {/* Where the line lands, a pulse — the patient's side of it */}
          <span
            className="absolute left-1/2 -translate-x-1/2 rounded-full"
            style={{
              bottom: 2,
              width: 10,
              height: 10,
              background: "var(--color-loader)",
              animation: "ndPulse 1.05s ease-out infinite",
            }}
          />
        </div>

        {/* ---------------- The wordmark, filling ---------------- */}
        <div className="flex items-baseline gap-[1px]" aria-hidden>
          {LETTERS.split("").map((ch, i) => {
            // Each letter fills in turn, so the word reads as a gauge.
            const share = 100 / LETTERS.length;
            const letterPct = Math.max(0, Math.min(100, (pct - i * share) / share * 100));
            return (
              <span key={i} className="relative" style={{ font: "700 clamp(26px,7vw,44px)/1 var(--font-display)", letterSpacing: "-0.03em" }}>
                <span style={{ color: "var(--color-line)" }}>{ch}</span>
                <span
                  className="absolute inset-0 overflow-hidden"
                  style={{ width: `${letterPct}%`, color: "var(--color-ink)" }}
                >
                  {ch}
                </span>
              </span>
            );
          })}
        </div>

        {/* ---------------- The number, as every Fill carries one ---------------- */}
        <div className="flex items-center gap-3">
          <span
            className="t-micro"
            style={{ color: "var(--color-ink-3)" }}
          >
            {label}
          </span>
          <span
            style={{
              font: "500 13px/1 var(--font-mono)",
              fontVariantNumeric: "tabular-nums",
              color: "var(--color-loader-ink)",
            }}
          >
            {/* U+2007 FIGURE SPACE: digit-width and non-collapsing, so the row
                holds still as the number widens. An ASCII space would collapse. */}
            {String(pct).padStart(3, " ")}%
          </span>
        </div>
      </div>
    </div>
  );
}
