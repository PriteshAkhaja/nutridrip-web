"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { DripLoader } from "./DripLoader";

const FIRST_VISIT_KEY = "nd_seen_intro";

/** Long enough to cover the fetch, short enough to sit through four times. */
const ROUTE_LOADER_MS = 520;
const INTRO_LOADER_MS = 1500;

/*
 * "Has this browser session seen the intro" is an external fact, so it is read
 * through a tiny store rather than copied into state inside an effect. The
 * server snapshot says "seen", so the HTML never carries a loader and search
 * engines and anyone without JavaScript get the page itself, and the content
 * is painted before the overlay arrives. That ordering is deliberate — an
 * overlay a frame late beats markup that hides the page from a crawler — and it
 * is why the intro is kept short and shown once per browser session.
 */
let seenInMemory = false;
const listeners = new Set<() => void>();

function readSeen(): boolean {
  if (seenInMemory) return true;
  try {
    return sessionStorage.getItem(FIRST_VISIT_KEY) === "1";
  } catch {
    // Private mode or blocked storage — show it, it is only 1.5 seconds.
    return false;
  }
}

function markSeen() {
  seenInMemory = true;
  try {
    sessionStorage.setItem(FIRST_VISIT_KEY, "1");
  } catch {
    // The in-memory flag covers this tab until it is closed.
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const serverSnapshot = () => true;

/**
 * Two different loads, two different lengths.
 *
 * The full sequence runs once per browser session, on the first page anyone
 * lands on. After that, moving to a drip gets a short one — long enough to
 * cover the fetch, short enough that nobody who is comparing four drips has to
 * sit through it four times.
 */
export function LoaderProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const seen = useSyncExternalStore(subscribe, readSeen, serverSnapshot);
  const [routeLoad, setRouteLoad] = useState(false);
  const previous = useRef(pathname);
  const stopRouteLoad = useCallback(() => setRouteLoad(false), []);

  // A drip page is the one route worth covering, because it is the page people
  // arrive at from an ad and the one whose stock figure is computed live.
  useEffect(() => {
    if (pathname === previous.current) return;
    previous.current = pathname;
    const toProduct = pathname.startsWith("/drips/") && pathname !== "/drips";
    if (!toProduct || !seen) return;

    // Deferred a tick so the state change happens in a callback, not the effect body.
    const show = window.setTimeout(() => setRouteLoad(true), 0);
    // The loader dismisses itself through onDone once its fade has finished
    // (ROUTE_LOADER_MS, then a 420ms fade). This is only the safety net for a
    // loader whose animation frames never ran — a backgrounded tab, say — so it
    // must sit *after* the fade, or it would cut the loader off mid-dissolve.
    const failsafe = window.setTimeout(() => setRouteLoad(false), ROUTE_LOADER_MS + 1200);
    return () => {
      window.clearTimeout(show);
      window.clearTimeout(failsafe);
    };
  }, [pathname, seen]);

  return (
    <>
      {children}
      {!seen && <DripLoader durationMs={INTRO_LOADER_MS} label="Preparing" onDone={markSeen} />}
      {routeLoad && <DripLoader durationMs={ROUTE_LOADER_MS} label="Drawing up" onDone={stopRouteLoad} />}
    </>
  );
}
