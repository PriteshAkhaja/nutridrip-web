"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

/**
 * The design system's one rule is that a Fill always encodes a real quantity.
 * So the loader is that primitive at page scale, in the client's look (the
 * public site's design, adopted 2026-10-30): the site's own bag fills as the
 * NutriDrip™ wordmark fills, and the counter carries the actual number.
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
 *
 * It sits outside .sc-site, so it reads its own tokens (--color-loader-*,
 * globals.css), which hold the site's values. The bag is a small copy of the
 * site's (loader-bag.webp, about 20 KB, fetched with the page at low priority
 * and cached after), and its liquid's mask is data in globals.css
 * (.nd-loader-mask), so both are there from the intro's first frame.
 */

/** How long the intro's count takes. globals.css reads it as --intro-ms. */
export const INTRO_MS = 800;

/** The route loader's fade out. */
const FADE_MS = 300;

/** A navigation quicker than this never shows the route loader at all. */
const ROUTE_SHOW_AFTER_MS = 400;

/** However the navigation ends, the route loader is never left up longer than this. */
const ROUTE_GIVE_UP_MS = 10_000;

/** The site's faces (their @font-face rules are in v3/styles/site.css). */
const DISPLAY = '"Outfit", "Geist", system-ui, sans-serif';
const TEXT = '"Geist", system-ui, sans-serif';

/** The wordmark as the site sets it (v3/Wordmark.tsx): NutriDrip, and its ™ raised. */
function Mark() {
  return (
    <>
      NutriDrip
      <sup
        style={{
          fontSize: "0.42em",
          fontWeight: 600,
          verticalAlign: "top",
          marginLeft: "0.06em",
          position: "relative",
          top: "0.1em",
        }}
      >
        ™
      </sup>
    </>
  );
}

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
  const css = pct === undefined;
  /** The bag and the wordmark both read the count: one quantity, three readings. */
  const share = Math.max(0, Math.min(100, pct ?? 0));

  return (
    <div
      className={`fixed inset-0 z-100 flex-col items-center justify-center ${className}`}
      style={{
        background: "var(--color-loader-ground)",
        color: "var(--color-loader-text)",
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
      <div className="flex flex-col items-center px-6" style={{ gap: "clamp(1.5rem, 4dvh, 2.4rem)" }}>
        {/* ---------------- The site's bag, filling ---------------- */}
        <div className="relative" aria-hidden style={{ width: "clamp(64px, 7vw, 88px)", aspectRatio: "176 / 366" }}>
          {/* Its liquid, inside the bag's own shape: the same span of the bag
              (13.5% to 93% of its height) the site's bags fill. */}
          <span className="nd-loader-mask absolute inset-0">
            <span
              className={`absolute inset-x-0 ${css ? "intro-fluid" : ""}`}
              style={{
                bottom: "13.5%",
                height: "79.5%",
                transformOrigin: "50% 100%",
                opacity: 0.9,
                background:
                  "linear-gradient(180deg, color-mix(in oklab, var(--color-loader) 30%, #fff), color-mix(in oklab, var(--color-loader) 62%, #fff))",
                ...(css
                  ? {}
                  : { transform: `scaleY(${(share / 100).toFixed(3)})`, transition: "transform 90ms linear" }),
              }}
            />
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element -- a fixed, tiny asset in a CSS-only drawing */}
          <img
            src="/site/v3/loader-bag.webp"
            alt=""
            width={176}
            height={366}
            // Fetched with the page (it is hidden, not lazy: lazy waits until it
            // shows, and the intro is over in 0.8 s), behind the page's own.
            fetchPriority="low"
            decoding="async"
            className="absolute inset-0 h-full w-full"
          />
        </div>

        {/* ---------------- The wordmark, filling ---------------- */}
        <div className="flex flex-col items-center" aria-hidden style={{ lineHeight: 1 }}>
          <span
            className="relative inline-block"
            style={{ font: `700 clamp(30px, 4.6vw, 44px)/1 ${DISPLAY}`, letterSpacing: "-0.035em" }}
          >
            <span style={{ color: "var(--color-loader-line)" }}>
              <Mark />
            </span>
            {/* The ink copy, uncovered left to right as the count rises. */}
            <span
              className={`absolute inset-0 ${css ? "intro-mark" : ""}`}
              style={{
                color: "var(--color-loader-text)",
                ...(css ? {} : { clipPath: `inset(0 ${100 - share}% 0 0)`, transition: "clip-path 90ms linear" }),
              }}
            >
              <Mark />
            </span>
          </span>
          <span
            style={{
              font: `600 clamp(8px, 0.95vw, 10.5px)/1 ${TEXT}`,
              letterSpacing: "0.26em",
              marginTop: "0.75em",
              color: "var(--color-loader-muted)",
            }}
          >
            IV NUTRIENT THERAPY
          </span>
        </div>

        {/* ---------------- The number, as every Fill carries one ---------------- */}
        <div className="flex items-center gap-3">
          <span
            style={{
              font: `600 11px/1 ${TEXT}`,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--color-loader-muted)",
            }}
          >
            {label}
          </span>
          <span
            className={css ? "intro-count" : undefined}
            style={{
              font: `600 13px/1 ${TEXT}`,
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
 * from that first frame: the count, the bag filling, the wordmark filling,
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
