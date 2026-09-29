"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";

/**
 * The design system's one rule is that a Fill always encodes a real quantity.
 * So the loader is that primitive at page scale: the bag drains as the
 * wordmark fills, and the counter carries the actual number.
 *
 * The page is already in the DOM underneath, which matters for search engines
 * and means nothing has to be re-fetched when the loader goes. It does cover
 * the viewport while it runs, so it is deliberately brief, and announced once
 * rather than on every frame — a counter updating 60 times a second inside a
 * live region is unusable with a screen reader.
 *
 * Two drivers share the one drawing:
 * - IntroLoader, the brand moment on a visitor's first page of the day. Pure
 *   CSS from the first frame, so it plays the same however long the page's
 *   JavaScript takes to arrive (a phone on Wi-Fi, a slow network).
 * - RouteLoader, on the way to a drip page, and only while that page is
 *   genuinely still on its way. It never holds back a page that has arrived.
 */

const LETTERS = "NUTRIDRIP";

/** How long the intro's count takes. globals.css reads it as --intro-ms. */
export const INTRO_MS = 800;

/** The route loader's fade out. */
const FADE_MS = 300;

/** A navigation quicker than this never shows the route loader at all. */
const ROUTE_SHOW_AFTER_MS = 400;

/** However the navigation ends, the route loader is never left up longer than this. */
const ROUTE_GIVE_UP_MS = 10_000;

/**
 * When, as a share of the count, the eased progress reaches letter `i` of
 * the wordmark: the inverse of 1 - (1 - t)^2.2, the curve the count follows,
 * so each letter fills as the number passes its share.
 */
const letterAt = (i: number) => 1 - Math.pow(1 - i / LETTERS.length, 1 / 2.2);

function DripLoaderView({
  pct,
  label,
  leaving = false,
  className,
  style,
}: {
  /** The number to show. Left out, the drawing animates itself from CSS (the intro). */
  pct?: number;
  label: string;
  leaving?: boolean;
  /** Decides the display: the intro's CSS gate, or the route loader's own state. */
  className: string;
  style?: CSSProperties;
}) {
  // Two loaders can overlap for a moment, and each bag clips to its own shape.
  const clipId = useId();
  const css = pct === undefined;

  /** The bag empties as the wordmark fills — one quantity, two readings. */
  const remaining = 100 - (pct ?? 0);

  return (
    <div
      className={`fixed inset-0 z-[100] flex-col items-center justify-center bg-white ${className}`}
      style={{
        ...(css
          ? { ["--intro-ms" as string]: `${INTRO_MS}ms` }
          : {
              transition: `opacity ${FADE_MS}ms ease-out, visibility ${FADE_MS}ms`,
              opacity: leaving ? 0 : 1,
              visibility: leaving ? "hidden" : "visible",
            }),
        ...style,
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
              <clipPath id={clipId}>
                <path d="M20 10h56a6 6 0 0 1 6 6v78a26 26 0 0 1-26 26H40a26 26 0 0 1-26-26V16a6 6 0 0 1 6-6Z" />
              </clipPath>
            </defs>

            {/* Fluid — drops as the load completes */}
            <g clipPath={`url(#${clipId})`}>
              <rect x="0" y="0" width="96" height="120" fill="var(--color-loader-soft)" />
              {css ? (
                <rect className="intro-fluid" x="0" y="0" width="96" height="120" fill="var(--color-loader)" />
              ) : (
                <rect
                  x="0"
                  width="96"
                  fill="var(--color-loader)"
                  y={120 - (remaining / 100) * 120}
                  height={(remaining / 100) * 120}
                  style={{ transition: "y 90ms linear, height 90ms linear" }}
                />
              )}
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
            const letterPct = Math.max(0, Math.min(100, (((pct ?? 0) - i * share) / share) * 100));
            return (
              <span
                key={i}
                className="relative"
                style={{ font: "700 clamp(26px,7vw,44px)/1 var(--font-display)", letterSpacing: "-0.03em" }}
              >
                <span style={{ color: "var(--color-line)" }}>{ch}</span>
                {css ? (
                  <span
                    className="intro-letter absolute inset-0"
                    style={{
                      color: "var(--color-ink)",
                      animationDelay: `${Math.round(letterAt(i) * INTRO_MS)}ms`,
                      animationDuration: `${Math.round((letterAt(i + 1) - letterAt(i)) * INTRO_MS)}ms`,
                    }}
                  >
                    {ch}
                  </span>
                ) : (
                  <span
                    className="absolute inset-0 overflow-hidden"
                    style={{ width: `${letterPct}%`, color: "var(--color-ink)" }}
                  >
                    {ch}
                  </span>
                )}
              </span>
            );
          })}
        </div>

        {/* ---------------- The number, as every Fill carries one ---------------- */}
        <div className="flex items-center gap-3">
          <span className="t-micro" style={{ color: "var(--color-ink-3)" }}>
            {label}
          </span>
          <span
            className={css ? "intro-count" : undefined}
            style={{
              font: "500 13px/1 var(--font-mono)",
              fontVariantNumeric: "tabular-nums",
              color: "var(--color-loader-ink)",
            }}
          >
            {/* U+2007 FIGURE SPACE: digit-width and non-collapsing, so the row
                holds still as the number widens. An ASCII space would collapse.
                The intro's number is drawn by CSS (a counter). */}
            {css ? null : `${String(pct).padStart(3, " ")}%`}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * A visitor's first page of the day opens on this.
 *
 * It is in the server HTML of every public page, and the CSS gate in
 * globals.css keeps it out of sight unless the root layout's boot script set
 * `intro-pending` on <html> before first paint. Everything it does is CSS
 * from that first frame: the count, the bag draining, the letters filling,
 * then the fade. The boot script ends it when the count's animation actually
 * finishes, so it plays in full however long the page's JavaScript takes;
 * nothing here waits for React.
 */
export function IntroLoader() {
  return <DripLoaderView label="Preparing" className="intro-gate" />;
}

/**
 * Covers the wait for a drip page — the page people arrive at from an ad, and
 * the one whose stock figure is computed live — but only a real wait: it stays
 * hidden unless the page takes longer than ROUTE_SHOW_AFTER_MS, creeps towards
 * 90% while it is on its way (the last stretch belongs to the page actually
 * arriving), and steps aside the moment it lands.
 */
export function RouteLoader({ arrived, onDone }: { arrived: boolean; onDone: () => void }) {
  const [shown, setShown] = useState(false);
  const [pct, setPct] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const shownRef = useRef(false);

  useEffect(() => {
    let frame = 0;
    const show = window.setTimeout(() => {
      shownRef.current = true;
      setShown(true);
      const start = performance.now();
      const tick = (now: number) => {
        const next = Math.round(90 * (1 - Math.exp(-(now - start) / 900)));
        setPct((p) => Math.max(p, next));
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }, ROUTE_SHOW_AFTER_MS);
    // A navigation that never lands (a failed request, a cancelled click)
    // must not leave the page covered.
    const giveUp = window.setTimeout(onDone, ROUTE_GIVE_UP_MS);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(giveUp);
      cancelAnimationFrame(frame);
    };
  }, [onDone]);

  useEffect(() => {
    if (!arrived) return;
    let fade = 0;
    const frame = requestAnimationFrame(() => {
      // It arrived before the loader ever showed: nothing to take down.
      if (!shownRef.current) {
        onDone();
        return;
      }
      setPct(100);
      setLeaving(true);
      fade = window.setTimeout(onDone, FADE_MS + 40);
    });
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(fade);
    };
  }, [arrived, onDone]);

  return (
    <DripLoaderView
      pct={pct}
      label="Drawing up"
      leaving={leaving}
      className={shown ? "flex" : "hidden"}
      style={shown ? { animation: "ndLoaderIn 200ms ease-out" } : undefined}
    />
  );
}
