"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from "react";
import { PAGE_SIZES, hrefWith, pageWindow, type PageMeta } from "@/lib/pagination";

/**
 * Pagination, the way the app draws it.
 *
 * Three parts that work together:
 *
 *   <PagedView>            holds "a new page is loading" for everything inside it
 *     <PagedResults>       the table — dimmed, not replaced, while the next page loads
 *     <Pagination />       the controls
 *
 * The list is URL-driven: every page, page size and filter is a query parameter,
 * so a page can be bookmarked, shared, reloaded and reached with the back button,
 * and the rows themselves are fetched by the database for exactly that page.
 * This component only draws the controls and moves the URL; it never sees rows.
 */

type Nav = {
  pending: boolean;
  start: (fn: () => void) => void;
  resultsRef: RefObject<HTMLDivElement | null>;
};

const Navigation = createContext<Nav | null>(null);

/** Shared with any bar that changes the URL (the audit filters use it too). */
export function useNavigation() {
  return useContext(Navigation);
}

export function PagedView({ children }: { children: ReactNode }) {
  const [pending, start] = useTransition();
  const resultsRef = useRef<HTMLDivElement | null>(null);
  return <Navigation.Provider value={{ pending, start, resultsRef }}>{children}</Navigation.Provider>;
}

/**
 * The rows while another page is on its way: dimmed, not swapped for a skeleton.
 * Somebody may still be reading the page they are leaving, and a skeleton would
 * make every click feel slower than it is. The dim waits 150ms, so an answer
 * that comes back quickly never flickers.
 */
export function PagedResults({ children }: { children: ReactNode }) {
  const nav = useContext(Navigation);
  const pending = nav?.pending ?? false;
  return (
    <div
      ref={nav?.resultsRef}
      aria-busy={pending || undefined}
      // The header is sticky, so scrolling the top of the table to the very top
      // of the window would tuck its first row underneath it.
      className={`scroll-mt-28 transition-opacity ${
        pending ? "opacity-45 duration-200 delay-150 pointer-events-none" : "opacity-100 duration-100"
      }`}
    >
      {children}
    </div>
  );
}

/**
 * No `display` in here on purpose. `hidden` and `inline-flex` are both display
 * utilities and the later one in the stylesheet wins, so a button that carried
 * both was never hidden — First and Last showed on a phone. Each user of this
 * says how it is displayed.
 */
const btnBase =
  "items-center justify-center rounded-[var(--radius-sm)] border font-semibold t-small no-underline hover:no-underline " +
  "min-h-[44px] min-w-[44px] lg:min-h-[36px] lg:min-w-[36px] px-3 transition-colors select-none";
const btn = `inline-flex ${btnBase}`;
const idle =
  "border-[var(--color-line-2)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary-dark)]";
const current = "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)]";
const off = "border-[var(--color-line)] bg-[var(--color-surface-2)] text-[var(--color-ink-3)] cursor-not-allowed";

export function Pagination({
  meta,
  basePath,
  params,
  nouns = ["result", "results"],
}: {
  meta: PageMeta;
  basePath: string;
  /** Every query parameter on the page now, so a change of page keeps the filters. */
  params: Record<string, string | string[] | undefined>;
  /** [singular, plural], for "Showing 1–25 of 137 people". */
  nouns?: [string, string];
}) {
  const router = useRouter();
  const nav = useContext(Navigation);
  const [, startLocal] = useTransition();
  const start = nav?.start ?? startLocal;
  const [jump, setJump] = useState("");

  const at = (overrides: Record<string, string | number | undefined>) => hrefWith(basePath, params, overrides);
  const go = (href: string) => start(() => router.push(href, { scroll: false }));

  /** Real links, so middle-click and copy-link work; a plain click just moves the URL without a jump. */
  const follow = (href: string) => (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(href);
  };

  // After a new page arrives, bring the top of the table into view if the click
  // happened at the foot of a long one — otherwise the rows change somewhere
  // above the reader, out of sight. Not on first render, and not when the table
  // is already on screen.
  const previous = useRef(meta.page);
  useEffect(() => {
    if (previous.current === meta.page) return;
    previous.current = meta.page;
    const el = nav?.resultsRef.current;
    if (!el) return;
    if (el.getBoundingClientRect().top < 0) {
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "start" });
    }
  }, [meta.page, nav]);

  if (meta.total === 0) return null;

  const [one, many] = nouns;
  const noun = meta.total === 1 ? one : many;
  const many_pages = meta.totalPages > 1;
  const strip = pageWindow(meta.page, meta.totalPages);
  // A short list needs no controls, but somebody who picked 100 a row on a
  // 40-row list still needs a way back to a smaller page.
  const showSize = meta.total > PAGE_SIZES[0];

  const submitJump = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    const n = Number(jump);
    if (!Number.isFinite(n)) return;
    const target = Math.min(Math.max(1, Math.floor(n)), meta.totalPages);
    setJump("");
    go(at({ page: target }));
  };

  const hasControls = showSize || meta.totalPages > 7;

  // Where each part sits, by screen:
  //   phone            stacked: the strip, what is on screen, rows-per-page
  //   tablet, laptop   the strip centred on top; below it, what is on screen on
  //                    the left and rows-per-page and jump on the right
  //   wide (1536+)     all three in one row — it does not fit before that: the
  //                    console's own sidebar leaves a laptop about 730px, and
  //                    even at 1440 the single row met the edge with no room.
  // An empty first row would still add a gap, so with no strip nothing is
  // pinned to row 2.
  const stripPlace = "order-1 md:col-span-2 md:row-start-1 2xl:col-span-1 2xl:col-start-2";
  const summaryPlace = many_pages
    ? "order-2 md:col-start-1 md:row-start-2 2xl:row-start-1"
    : "order-2 md:col-start-1 2xl:row-start-1";
  const controlsPlace = many_pages
    ? "order-3 md:col-start-2 md:row-start-2 2xl:col-start-3 2xl:row-start-1"
    : "order-3 md:col-start-2 2xl:col-start-3 2xl:row-start-1";

  return (
    <nav
      aria-label="Pagination"
      className="mt-5 grid grid-cols-1 items-center gap-x-6 gap-y-4 md:grid-cols-[1fr_auto] 2xl:grid-cols-[auto_1fr_auto]"
    >
      {/* ---- What is on screen. ---- */}
      <p className={`t-small text-[var(--color-ink-2)] ${summaryPlace}`} aria-live="polite">
        Showing <span className="t-data text-[13px] text-[var(--color-ink)]">{meta.from.toLocaleString("en-IN")}</span>
        {"–"}
        <span className="t-data text-[13px] text-[var(--color-ink)]">{meta.to.toLocaleString("en-IN")}</span> of{" "}
        <span className="t-data text-[13px] text-[var(--color-ink)]">{meta.total.toLocaleString("en-IN")}</span> {noun}
      </p>

      {many_pages ? (
        <div className={`${stripPlace} flex items-center justify-between sm:justify-center gap-2`}>
          {/* First and last: only where there is room, and only on a long list. */}
          {meta.totalPages > 7 ? (
            <Edge label="First page" href={at({ page: 1 })} disabled={!meta.hasPrev} onFollow={follow} glyph="«" />
          ) : null}

          <Edge
            label="Previous page"
            href={at({ page: meta.page - 1 })}
            disabled={!meta.hasPrev}
            onFollow={follow}
            glyph="‹"
            text="Previous"
          />

          {/* Phone: a sentence, not a row of numbers that would not fit. */}
          <span className="sm:hidden t-small text-[var(--color-ink-2)] whitespace-nowrap">
            Page <span className="t-data text-[13px] text-[var(--color-ink)]">{meta.page}</span> of{" "}
            <span className="t-data text-[13px] text-[var(--color-ink)]">{meta.totalPages.toLocaleString("en-IN")}</span>
          </span>

          {/* Tablet and up: the numbered strip. */}
          <ul className="hidden sm:flex items-center gap-1 list-none p-0 m-0">
            {strip.map((item) =>
              typeof item === "string" ? (
                <li
                  key={item}
                  aria-hidden
                  className="inline-flex items-center justify-center min-w-[24px] self-center leading-none text-[16px] text-[var(--color-ink-3)] select-none"
                >
                  …
                </li>
              ) : (
                <li key={item}>
                  {item === meta.page ? (
                    <span aria-current="page" className={`${btn} ${current}`}>
                      {item}
                    </span>
                  ) : (
                    <Link
                      href={at({ page: item })}
                      onClick={follow(at({ page: item }))}
                      aria-label={`Page ${item}`}
                      prefetch={false}
                      className={`${btn} ${idle}`}
                    >
                      {item}
                    </Link>
                  )}
                </li>
              )
            )}
          </ul>

          <Edge
            label="Next page"
            href={at({ page: meta.page + 1 })}
            disabled={!meta.hasNext}
            onFollow={follow}
            glyph="›"
            text="Next"
            textFirst
          />

          {meta.totalPages > 7 ? (
            <Edge
              label="Last page"
              href={at({ page: meta.totalPages })}
              disabled={!meta.hasNext}
              onFollow={follow}
              glyph="»"
            />
          ) : null}
        </div>
      ) : null}

      {/* ---- Rows per page, and jump-to-page on a screen with room for it. ---- */}
      {hasControls ? (
        <div className={`${controlsPlace} flex items-center justify-between md:justify-end gap-4`}>
          {showSize ? (
            <label className="flex items-center gap-2 t-small text-[var(--color-ink-2)]">
              <span className="whitespace-nowrap">Rows per page</span>
              <select
                value={meta.pageSize}
                onChange={(e) => go(at({ pageSize: e.target.value, page: 1 }))}
                className="min-h-[44px] lg:min-h-[36px] rounded-[var(--radius-sm)] border border-[var(--color-line-2)] bg-[var(--color-surface)] px-2 t-small text-[var(--color-ink)] cursor-pointer"
              >
                {[...new Set([...PAGE_SIZES, meta.pageSize])]
                  .sort((a, b) => a - b)
                  .map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
              </select>
            </label>
          ) : null}

          {meta.totalPages > 7 ? (
            <form onSubmit={submitJump} className="hidden md:flex items-center gap-2 t-small text-[var(--color-ink-2)]">
              <label htmlFor="jump-to-page" className="whitespace-nowrap">
                Go to
              </label>
              <input
                id="jump-to-page"
                type="number"
                inputMode="numeric"
                min={1}
                max={meta.totalPages}
                value={jump}
                onChange={(e) => setJump(e.target.value)}
                placeholder={String(meta.page)}
                className="w-[72px] min-h-[44px] lg:min-h-[36px] rounded-[var(--radius-sm)] border border-[var(--color-line-2)] bg-[var(--color-surface)] px-2 t-data text-[13px]"
              />
              <button type="submit" className={`${btn} ${idle}`} disabled={jump.trim() === ""}>
                Go
              </button>
            </form>
          ) : null}
        </div>
      ) : null}
    </nav>
  );
}

/** Previous, Next, First, Last — one shape, a real link when it can be followed. */
function Edge({
  label,
  href,
  disabled,
  onFollow,
  glyph,
  text,
  textFirst = false,
}: {
  label: string;
  href: string;
  disabled: boolean;
  onFollow: (href: string) => (e: MouseEvent<HTMLAnchorElement>) => void;
  glyph: string;
  text?: string;
  textFirst?: boolean;
}) {
  // First and last are hidden on a phone, where there is no room for four
  // buttons and a sentence; previous and next never are.
  const shown = text ? "inline-flex" : "hidden sm:inline-flex";
  const inner = (
    <>
      {textFirst && text ? <span className="sm:hidden lg:inline">{text}</span> : null}
      <span aria-hidden className={text ? "text-[18px] leading-none" : "text-[16px] leading-none"}>
        {glyph}
      </span>
      {!textFirst && text ? <span className="sm:hidden lg:inline">{text}</span> : null}
    </>
  );
  const gap = text ? "gap-1.5" : "";

  return disabled ? (
    <span aria-disabled="true" aria-label={label} className={`${btnBase} ${shown} ${off} ${gap}`}>
      {inner}
    </span>
  ) : (
    <Link href={href} onClick={onFollow(href)} aria-label={label} className={`${btnBase} ${shown} ${idle} ${gap}`} prefetch={false}>
      {inner}
    </Link>
  );
}
