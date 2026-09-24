"use client";

import { Fragment, useEffect, useState, type ComponentProps, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Clicking the menu entry for the page you are already on goes back to that
 * page's start.
 *
 * Without this, a link to the current address does nothing: an open editor
 * (a quiz question, a drip, a zone) stays open, because it is held in the
 * page's memory and the address never changed. People expect the menu to take
 * them to the page's main view, as it would from anywhere else.
 */
export const PAGE_RESET_EVENT = "nd:page-reset";

/** A menu link. Elsewhere it is an ordinary link; on its own page it resets the page. */
export function NavLink({ href, onClick, ...rest }: ComponentProps<typeof Link> & { href: string }) {
  const router = useRouter();

  const click = (e: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(e);
    // A new tab, a new window or a download: leave it to the browser.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (window.location.pathname !== href) return;

    e.preventDefault();
    // Drop anything in the address that opened something (?edit=…, a filter),
    // otherwise just fetch the page's data again.
    if (window.location.search || window.location.hash) router.push(href);
    else router.refresh();
    window.dispatchEvent(new Event(PAGE_RESET_EVENT));
    window.scrollTo({ top: 0 });
  };

  return <Link href={href} onClick={click} {...rest} />;
}

/**
 * Wraps a page's content so a reset starts it afresh: every form, open editor
 * and half-typed field inside goes back to how the page first loads.
 */
export function PageReset({ children }: { children: ReactNode }) {
  const [round, setRound] = useState(0);

  useEffect(() => {
    const reset = () => setRound((n) => n + 1);
    window.addEventListener(PAGE_RESET_EVENT, reset);
    return () => window.removeEventListener(PAGE_RESET_EVENT, reset);
  }, []);

  return <Fragment key={round}>{children}</Fragment>;
}
