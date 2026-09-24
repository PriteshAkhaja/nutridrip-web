"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { PAGE_RESET_EVENT } from "./PageReset";
import { usePathname } from "next/navigation";
import { LogoMark } from "./Logo";

/**
 * The console rail, and what it becomes on a screen too narrow to keep it.
 *
 * At `lg` and up it is the 236px sticky column it always was. Below that it
 * used to stack above the page, and with fourteen 44px rows that put every
 * screen's actual content below the fold on a phone — an admin who tapped
 * "Audit trail" saw the menu and nothing else. So below `lg` the same element
 * becomes a drawer behind a sticky bar.
 *
 * It is ONE element either way, moved by CSS, not a second copy of the nav.
 * The server renders it closed; `lg:` classes show it on a wide screen and the
 * base classes hide it on a narrow one, so the first paint is already right on
 * both and nothing jumps when React hydrates.
 *
 * Closed, it is `invisible` rather than merely off-screen. A translated-away
 * drawer still puts fourteen links in the tab order and reads them to a screen
 * reader; visibility removes them. It transitions with the slide, so closing
 * still animates before the links go.
 */
export function ConsoleRail({
  children,
  actions,
}: {
  children: ReactNode;
  /** The right end of the phone/tablet bar — the bell lives here below lg. */
  actions?: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const asideRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Adjusting state during render on a path change is the React-sanctioned
  // alternative to an effect — the same pattern MobileNav uses. Covers the
  // back button, which no click handler would see.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) toggleRef.current?.focus();
  };

  // The menu entry for the page already open resets it without a new
  // address, so the path check above never sees it: close on that too.
  useEffect(() => {
    const onReset = () => setOpen(false);
    window.addEventListener(PAGE_RESET_EVENT, onReset);
    return () => window.removeEventListener(PAGE_RESET_EVENT, onReset);
  }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    // Rotating a tablet into landscape crosses `lg` with the drawer open. The
    // rail is a column there, so the lock and the listeners must not outlive it.
    const wide = window.matchMedia("(min-width: 1024px)");
    const onWide = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false);
    };

    // The page behind must not scroll under a thumb that is scrolling the menu.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    wide.addEventListener("change", onWide);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", onKey);
      wide.removeEventListener("change", onWide);
    };
  }, [open]);

  /*
   * With only the nav scrolling, a short screen can leave the page you are on
   * below the fold of the menu, and the highlight that says "you are here" goes
   * unseen. Brought into view on each page and each opening. The nav's own
   * scrollTop is set directly: scrollIntoView would also scroll the page.
   */
  useEffect(() => {
    const nav = asideRef.current?.querySelector("nav");
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active) return;
    const n = nav.getBoundingClientRect();
    const a = active.getBoundingClientRect();
    if (a.top < n.top) nav.scrollTop -= n.top - a.top + 8;
    else if (a.bottom > n.bottom) nav.scrollTop += a.bottom - n.bottom + 8;
  }, [pathname, open]);

  return (
    <>
      {/* Sticky, so the menu is one tap away at the bottom of a long table too. */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center gap-3 h-14 px-4 border-b border-[var(--color-line)] bg-[var(--color-surface)]">
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-controls="console-nav"
          aria-expanded={open}
          aria-label="Open menu"
          className="w-11 h-11 -ml-[6px] inline-flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-line-2)] bg-[var(--color-surface)] cursor-pointer"
        >
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
            <path d="M3 5h14M3 10h14M3 15h14" stroke="var(--color-ink)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <span className="flex gap-[10px] items-center">
          <LogoMark size={22} />
          <span style={{ font: "600 14.5px/1 var(--font-display)" }} className="text-[var(--color-ink)]">
            NutriDrip
          </span>
        </span>
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </div>

      {/* The scrim closes on tap, which is what people try first. It is not a
          button to a screen reader: Escape and the close button cover that. */}
      <div
        aria-hidden
        onClick={() => close()}
        className={`lg:hidden fixed inset-0 z-[60] bg-[rgba(10,12,14,0.4)] transition-opacity duration-200 ease-out ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      <aside
        ref={asideRef}
        id="console-nav"
        aria-label="Console navigation"
        // A tap on the page you are already on changes no path, so the render
        // check above never fires. Any link tapped inside closes the drawer.
        onClick={(e) => {
          if ((e.target as HTMLElement).closest("a")) setOpen(false);
        }}
        className={`fixed top-0 bottom-0 left-0 z-[70] w-[min(300px,85vw)] overflow-hidden
          bg-[var(--color-paper)] border-r border-[var(--color-line)] shadow-[var(--shadow-pop)]
          flex flex-col
          ${
            // Visibility is not faded — it is switched, on a different clock
            // each way. Opening, it turns visible at once: a transitioned
            // `visibility` is still `hidden` on the frame the effect runs, and
            // .focus() on a hidden element silently does nothing. Closing, it
            // waits out the 200ms slide, so the links go only once off screen.
            //
            // The slide animates `translate`, not `transform`: Tailwind v4's
            // translate-x-* write the standalone `translate` property, so a
            // transition on `transform` left the drawer snapping open.
            open
              ? "translate-x-0 visible [transition:translate_200ms_ease-out,visibility_0s]"
              : "-translate-x-full invisible [transition:translate_200ms_ease-out,visibility_0s_200ms]"
          }
          lg:sticky lg:bottom-auto lg:z-auto lg:w-auto lg:h-dvh lg:shadow-none
          lg:translate-x-0 lg:visible lg:transition-none`}
      >
        {/* The rail’s own header: 56px, the height of the phone bar. It was
            briefly 83px to line its border up with the page header beside it,
            which left a small logo floating in a lot of empty space. A shorter
            header with a border would put two rules at different heights side
            by side, so on a wide screen it has none and the first section
            label does the separating. In the drawer the rule stays, because
            there it lands exactly on the 56px bar it slides over. The close
            control sits in the row rather than floating over it. */}
        <div className="shrink-0 h-14 border-b border-[var(--color-line)] lg:border-b-0 flex items-center gap-2 pl-5 pr-3">
          <Link
            href="/"
            className="flex gap-[10px] items-center no-underline hover:no-underline rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-primary)]"
          >
            <LogoMark size={22} />
            <span style={{ font: "600 14.5px/1 var(--font-display)" }} className="text-[var(--color-ink)]">
              NutriDrip
            </span>
          </Link>
          <button
            ref={closeRef}
            type="button"
            onClick={() => close()}
            aria-label="Close menu"
            className="lg:hidden ml-auto w-10 h-10 inline-flex items-center justify-center rounded-[var(--radius-sm)] cursor-pointer text-[var(--color-ink-2)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
          >
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden>
              <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </aside>
    </>
  );
}
