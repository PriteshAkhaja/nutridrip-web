"use client";

import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The site header: a white capsule floating a little clear of the top edge,
 * with the page showing around it. It gathers a soft shadow once the page
 * moves under it.
 *
 * The strip it sits in is transparent and lets clicks through, and it takes
 * no room of its own (the negative margin): every page's first section starts
 * under it and pads itself clear by --site-header-h, so the hero's colour runs
 * up behind the capsule instead of stopping at a white band.
 *
 * Solid white, deliberately not frosted glass: a backdrop blur on a bar that
 * stays on screen is recomputed from whatever scrolls beneath it on every
 * frame of every scroll. "Has the page moved" comes from an observer on a
 * marker at the top of the document, so scrolling runs no script.
 */
export function HeaderShell({ children }: { children: ReactNode }) {
  const [scrolled, setScrolled] = useState(false);
  const marker = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = marker.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setScrolled(!(entry?.isIntersecting ?? true)));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <>
      {/* The page's first 8px. Once it has scrolled out of view, so has the top. */}
      <div ref={marker} aria-hidden className="pointer-events-none absolute left-0 top-0 h-2 w-px" />
      <header
        data-scrolled={scrolled ? "" : undefined}
        className="site-header pointer-events-none sticky top-0 z-50 -mb-[var(--site-header-h)] px-3 pt-[var(--capsule-gap)] md:px-5"
      >
        <div className="site-capsule pointer-events-auto relative mx-auto flex h-[var(--capsule-h)] max-w-[1240px] items-center gap-3 rounded-full border border-[var(--color-line)] bg-white pl-4 pr-[7px] md:gap-4 md:pl-6 xl:gap-6">
          {children}
        </div>
      </header>
    </>
  );
}

type NavLink = { label: string; href: string };

const MENU_ID = "site-drips-menu";

/**
 * The inline menu, from 1280px (below that, a signed-in patient's
 * "…'s dashboard" beside "Answer your physician" pushed the header past the
 * edge of a 1024 screen, measured, so the menu button carries the links).
 *
 * A soft highlight glides to whichever item the pointer or keyboard is on,
 * and the current section sits in a tinted pill, marked for screen readers
 * too. The glide is one element moved with transform: no layout, no repaint
 * of the links themselves.
 *
 * "Drips" is still a plain link to the catalogue. Beside it a chevron button
 * opens `dripsMenu`: on hover for a mouse, on click or Enter for everyone
 * else. Escape, a click outside, focus moving on, choosing something in it,
 * or reaching another page all close it.
 */
export function NavLinks({ links, dripsMenu }: { links: NavLink[]; dripsMenu?: ReactNode }) {
  const pathname = usePathname();
  const nav = useRef<HTMLElement>(null);
  const group = useRef<HTMLSpanElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);
  const timers = useRef({ open: 0, close: 0 });
  const [open, setOpen] = useState(false);
  // Arriving on another page (a link, Back, Forward) closes it, adjusted
  // during render rather than by an effect.
  const [shownFor, setShownFor] = useState(pathname);
  if (shownFor !== pathname) {
    setShownFor(pathname);
    setOpen(false);
  }

  useEffect(() => {
    const t = timers.current;
    return () => {
      window.clearTimeout(t.open);
      window.clearTimeout(t.close);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof Node) || !group.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  const glideTo = (item: HTMLElement | null) => {
    const n = nav.current;
    if (!n || !item) return;
    const place = () => {
      n.style.setProperty("--glide-x", `${item.offsetLeft}px`);
      n.style.setProperty("--glide-y", `${item.offsetTop}px`);
      n.style.setProperty("--glide-w", `${item.offsetWidth}px`);
      n.style.setProperty("--glide-h", `${item.offsetHeight}px`);
    };
    if (!n.hasAttribute("data-glide")) {
      // Appearing: jump straight to the item rather than sliding in from
      // wherever it was last (it only slides while shown).
      place();
      void n.offsetWidth;
      n.setAttribute("data-glide", "");
    }
    place();
  };
  const glideOff = () => nav.current?.removeAttribute("data-glide");

  const openSoon = () => {
    window.clearTimeout(timers.current.close);
    window.clearTimeout(timers.current.open);
    timers.current.open = window.setTimeout(() => setOpen(true), 90);
  };
  const closeSoon = () => {
    window.clearTimeout(timers.current.open);
    window.clearTimeout(timers.current.close);
    timers.current.close = window.setTimeout(() => setOpen(false), 180);
  };

  const pill = (active: boolean) =>
    `relative z-10 rounded-full whitespace-nowrap text-[14px] font-medium no-underline hover:no-underline transition-colors duration-200 ${
      active
        ? "bg-[var(--color-primary-soft)] text-[var(--color-primary-text)]"
        : "text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
    }`;

  return (
    <nav
      ref={nav}
      aria-label="Main"
      className="relative hidden self-stretch items-center gap-1 xl:flex"
      onPointerLeave={glideOff}
      onBlur={(e) => {
        if (!(e.relatedTarget instanceof Node) || !nav.current?.contains(e.relatedTarget)) glideOff();
      }}
    >
      <span aria-hidden className="nav-glide" />
      {links.map((l) => {
        const active = pathname === l.href || pathname.startsWith(l.href + "/");

        if (l.href !== "/drips" || !dripsMenu) {
          return (
            <Fragment key={l.href}>
              <Link
                href={l.href}
                prefetch={false}
                aria-current={active ? "page" : undefined}
                className={`${pill(active)} px-[14px] py-2`}
                onPointerEnter={(e) => glideTo(e.currentTarget)}
                onFocus={(e) => glideTo(e.currentTarget)}
              >
                {l.label}
              </Link>
            </Fragment>
          );
        }

        return (
          <span
            key={l.href}
            ref={group}
            className={`${pill(active)} flex items-center`}
            onPointerEnter={(e) => {
              glideTo(group.current);
              if (e.pointerType === "mouse") openSoon();
            }}
            onPointerLeave={(e) => {
              if (e.pointerType === "mouse") closeSoon();
            }}
            onKeyDown={(e) => {
              if (e.key === "Escape" && open) {
                e.stopPropagation();
                setOpen(false);
                toggle.current?.focus();
              }
            }}
            onBlur={(e) => {
              if (!(e.relatedTarget instanceof Node) || !group.current?.contains(e.relatedTarget)) setOpen(false);
            }}
          >
            <Link
              href={l.href}
              prefetch={false}
              aria-current={active ? "page" : undefined}
              className="py-2 pl-[14px] pr-[2px] text-inherit no-underline hover:no-underline"
              onFocus={() => glideTo(group.current)}
            >
              {l.label}
            </Link>
            <button
              ref={toggle}
              type="button"
              aria-expanded={open}
              aria-controls={MENU_ID}
              aria-label="Drips by goal"
              className="mr-[6px] inline-flex h-7 w-6 cursor-pointer items-center justify-center rounded-full text-inherit transition-colors duration-200 hover:bg-black/5"
              onClick={() => setOpen(!open)}
              onFocus={() => glideTo(group.current)}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden
                focusable="false"
                className={`transition-transform duration-300 ${open ? "rotate-180" : ""}`}
              >
                <path
                  d="M3 4.5l3 3 3-3"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            {/* The padding above the card is a bridge: the pointer can cross
                from the item to the menu without leaving either. */}
            <div
              id={MENU_ID}
              hidden={!open}
              className="absolute left-0 top-full z-20 w-[min(720px,calc(100vw-48px))] whitespace-normal pt-3"
              // Choosing a goal can keep the same address (/drips to
              // /drips?goal=…), so a choice closes the menu itself.
              onClick={(e) => {
                if (e.target instanceof Element && e.target.closest("a")) setOpen(false);
              }}
            >
              <div className="drips-menu rounded-[26px] border border-[var(--color-line)] bg-white text-left shadow-[var(--shadow-float)]">
                {dripsMenu}
              </div>
            </div>
          </span>
        );
      })}
    </nav>
  );
}
