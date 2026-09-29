"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";

type NavLink = { label: string; href: string };

// "Are we in the browser yet", without setting state in an effect: false for
// the server render and hydration, true from then on.
const noopSubscribe = () => () => {};

/**
 * The header's menu below 1280px: a full-screen sheet with the same links set
 * large, and the booking button where a thumb can reach it.
 *
 * It behaves as a dialog. The page behind stops scrolling, focus moves into
 * the sheet and stays there (Tab cycles, Escape closes and returns focus to
 * the button that opened it), and it closes itself on navigation, so a tap on
 * a link never leaves it hanging open. While closed it is inert: present for
 * the entrance transition, invisible to the keyboard and to screen readers.
 */
export function MobileNav({
  links,
  account,
  cta,
  note,
}: {
  links: NavLink[];
  account: { label: string; href: string };
  /** The booking button, rendered on the server (it knows who is signed in). */
  cta?: ReactNode;
  note?: ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const inBrowser = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  // Adjusting state during render on a path change is the React-sanctioned
  // alternative to an effect here.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const sheet = sheetRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheet?.querySelector<HTMLElement>("[data-autofocus]")?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
        return;
      }
      if (e.key !== "Tab" || !sheet) return;
      const focusable = Array.from(sheet.querySelectorAll<HTMLElement>("a[href],button:not([disabled])"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };

  return (
    <div className="xl:hidden">
      <button
        ref={toggleRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-controls="site-mobile-nav"
        aria-label="Open menu"
        className="w-11 h-11 inline-flex items-center justify-center rounded-full border border-[var(--color-line-2)] bg-[var(--color-surface)] text-[var(--color-ink)] cursor-pointer transition-colors duration-200 hover:border-[var(--color-ink)]"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden style={{ display: "block" }}>
          <path d="M3 6.5h14M3 13.5h14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
      </button>

      {/* Portalled to <body>, so no ancestor can become the containing block
          for this fixed sheet: a backdrop-filter, transform or filter on the
          header does that, and when the header had a backdrop blur the
          "full-screen" sheet came out only as tall as the header. Not in the
          server HTML; the same links are in the desktop menu and the footer. */}
      {inBrowser ? createPortal(sheet(), document.body) : null}
    </div>
  );

  function sheet() {
    return (
      <div
        ref={sheetRef}
        id="site-mobile-nav"
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        inert={!open}
        className={`site fixed inset-0 z-[60] flex flex-col bg-[var(--color-paper)] transition-[opacity,transform] duration-300 ease-[var(--ease-glide)] ${
          open ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 -translate-y-2"
        }`}
      >
        <div className="flex items-center justify-between px-6 md:px-10 h-[var(--site-header-h)] border-b border-[var(--color-line)] flex-none">
          <Logo />
          <button
            type="button"
            onClick={close}
            aria-label="Close menu"
            className="w-11 h-11 inline-flex items-center justify-center rounded-full border border-[var(--color-line-2)] text-[var(--color-ink)] cursor-pointer hover:border-[var(--color-ink)]"
          >
            <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden style={{ display: "block" }}>
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-6 md:px-10 pt-4 pb-8" aria-label="Main">
          <ul className="list-none m-0 p-0">
            {links.map((l, i) => {
              const active = pathname === l.href || pathname.startsWith(l.href + "/");
              return (
                <li
                  key={l.href}
                  className={`border-b border-[var(--color-line)] transition-[opacity,transform] duration-500 ease-[var(--ease-glide)] ${
                    open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
                  }`}
                  style={{ transitionDelay: open ? `${80 + i * 45}ms` : "0ms" } as CSSProperties}
                >
                  <Link
                    href={l.href}
                    prefetch={false}
                    data-autofocus={i === 0 ? "" : undefined}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-[64px] items-center justify-between gap-4 no-underline hover:no-underline ${
                      active ? "text-[var(--color-primary-text)]" : "text-[var(--color-ink)]"
                    }`}
                    style={{ font: "600 clamp(24px, 6.4vw, 30px)/1.1 var(--font-display)", letterSpacing: "-0.03em" }}
                  >
                    {l.label}
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden
                      style={{ display: "block", flex: "none" }}
                    >
                      <path
                        d="M7 17L17 7M9 7h8v8"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity="0.45"
                      />
                    </svg>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div
          className={`flex-none border-t border-[var(--color-line)] px-6 md:px-10 pt-5 pb-[max(20px,env(safe-area-inset-bottom))] flex flex-col gap-3 transition-opacity duration-500 ${
            open ? "opacity-100" : "opacity-0"
          }`}
          style={{ transitionDelay: open ? "260ms" : "0ms" }}
        >
          {cta ? <div className="[&>a]:w-full">{cta}</div> : null}
          <Link
            href={account.href}
            prefetch={false}
            className="min-h-[48px] inline-flex items-center justify-center rounded-full border border-[var(--color-line-2)] text-[15px] font-semibold text-[var(--color-ink)] no-underline hover:no-underline hover:border-[var(--color-ink)]"
          >
            {account.label}
          </Link>
          {note ? <p className="t-small text-center text-[var(--color-ink-3)] mt-1">{note}</p> : null}
        </div>
      </div>
    );
  }
}
