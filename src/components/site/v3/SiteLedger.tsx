"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { QUESTIONS_BY_PATH, type PageQuestion } from "./questions";

const NONE: PageQuestion[] = [];

/**
 * The header's question button, the client's "ledger": on a page whose
 * sections carry data-q ("What is this?", "What does it cost?") it reads
 * "3/10 What does it cost?", ticking each question off once its section has
 * been read, and opens a list of them plus the site's pages. On a page with no
 * questions it is the "Menu" button, shown only where the nav links are not.
 *
 * The questions come from QUESTIONS_BY_PATH, so the server draws the right
 * button and the bar never shifts when the page loads; the page's sections
 * carry the same ids. done is a bitmask and now an index, so scrolling
 * re-renders only when either changes.
 */
export function SiteLedger({ pages }: { pages: Array<[label: string, href: string]> }) {
  const pathname = usePathname();
  const qs = QUESTIONS_BY_PATH[pathname] ?? NONE;
  const [now, setNow] = useState(0);
  const [done, setDone] = useState(0);
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let els: HTMLElement[] = [];
    let ticking = false;
    const tick = () => {
      ticking = false;
      const vh = innerHeight;
      let n = 0;
      let d = 0;
      els.forEach((s, i) => {
        const r = s.getBoundingClientRect();
        if (r.top < vh * 0.45) n = i;
        if (r.bottom < vh * 0.55) d |= 1 << i;
      });
      setNow(n);
      setDone((prev) => prev | d);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(tick);
    };
    // After this navigation's page has painted.
    const start = requestAnimationFrame(() => {
      els = qs.map((q) => document.getElementById(q.id)).filter((e): e is HTMLElement => !!e);
      setNow(0);
      setDone(0);
      setOpen(false);
      if (els.length) tick();
    });
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(start);
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
    };
  }, [qs]);

  // Closing: a click outside, or Escape (which hands focus back to the button).
  useEffect(() => {
    if (!open) return;
    panel.current?.querySelector<HTMLElement>("a")?.focus({ preventScroll: true });
    const onClick = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      button.current?.focus();
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const asked = qs.length > 0;
  const read = qs.filter((_, i) => done & (1 << i)).length;
  const current = qs[now]?.text ?? "";

  return (
    <>
      <button
        ref={button}
        className={asked ? "nd-ledger-btn" : "nd-ledger-btn nd-menu-btn"}
        type="button"
        aria-expanded={open}
        aria-controls="nd-ledger"
        title={asked ? current : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {asked ? (
          <>
            <span className="nd-ledger-btn__count">
              {read}/{qs.length}
            </span>
            <span className="nd-ledger-btn__q">{current}</span>
          </>
        ) : (
          "Menu"
        )}
      </button>
      <div
        ref={panel}
        className={open ? "nd-ledger is-open" : "nd-ledger"}
        id="nd-ledger"
        role="dialog"
        aria-label={asked ? "Your questions" : "Menu"}
      >
        <h2>{asked ? "Your questions, answered as you read" : "NutriDrip"}</h2>
        {asked ? (
          <ol>
            {qs.map((q, i) => (
              <li key={q.id} className={done & (1 << i) ? "is-done" : undefined}>
                <a
                  href={`#${q.id}`}
                  className={i === now ? "is-now" : undefined}
                  aria-current={i === now ? "step" : undefined}
                  onClick={() => setOpen(false)}
                >
                  <span className="tick" aria-hidden="true" />
                  <span>{q.text}</span>
                </a>
              </li>
            ))}
          </ol>
        ) : null}
        <div className="nd-ledger__pages">
          {pages.map(([label, href]) => (
            <Link key={href} href={href} prefetch={false} onClick={() => setOpen(false)}>
              {label}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
