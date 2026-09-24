"use client";

import Link from "next/link";
import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Arrow } from "@/components/ui/Arrow";
import { backFor, recordVisit, type Trail } from "@/lib/nav-trail";

const TRAIL = "nd_nav_trail";
const PREV = "nd_nav_prev";
const CHANGED = "nd-nav-trail";
/** Enough for a working day of screens; the oldest are forgotten first. */
const KEEP = 60;

function load(): Trail {
  try {
    return JSON.parse(sessionStorage.getItem(TRAIL) ?? "{}") as Trail;
  } catch {
    return {};
  }
}

/**
 * Notes each screen as it is reached, so a Back button can return to where the
 * person actually came from (see lib/nav-trail). Mounted once in the nurse and
 * patient apps; renders nothing.
 */
export function NavTrail() {
  const pathname = usePathname();
  useEffect(() => {
    try {
      const cur = window.location.pathname + window.location.search;
      const next = recordVisit(load(), sessionStorage.getItem(PREV), cur);
      const keys = Object.keys(next);
      for (const k of keys.slice(0, Math.max(0, keys.length - KEEP))) delete next[k];
      sessionStorage.setItem(TRAIL, JSON.stringify(next));
      sessionStorage.setItem(PREV, cur);
      window.dispatchEvent(new Event(CHANGED));
    } catch {
      // No storage (private mode): Back buttons use their usual parent.
    }
  }, [pathname]);
  return null;
}

function subscribe(changed: () => void) {
  window.addEventListener(CHANGED, changed);
  return () => window.removeEventListener(CHANGED, changed);
}

/**
 * The header's Back arrow. Goes where the page was entered from; until the
 * browser has said (and on a page opened fresh) it goes to `fallback`, the
 * page's usual parent -- so the first paint matches the server.
 */
export function BackLink({ fallback }: { fallback: { href: string; label: string } }) {
  const target = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(backFor(load(), window.location.pathname + window.location.search, fallback)),
    () => JSON.stringify(fallback)
  );
  const { href, label } = JSON.parse(target) as { href: string; label: string };
  return (
    <Link
      href={href}
      aria-label={label}
      className="w-11 h-11 -ml-2 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-ink-2)] no-underline hover:no-underline hover:bg-[var(--color-surface-2)]"
    >
      <Arrow dir="left" />
    </Link>
  );
}
