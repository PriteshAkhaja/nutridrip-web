"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { IntroLoader, RouteLoader } from "./DripLoader";

/** A drip page, which is where the route loader may cover the wait. */
const DRIP_PAGE = /^\/drips\/[^/]+\/?$/;

/**
 * Two loaders, and neither one adds a wait of its own.
 *
 * The intro runs on a visitor's first page of the day — a reload, a new tab
 * or the next page do not repeat it. It needs nothing from here: it is in the
 * server HTML, plays in CSS from first paint, and the root layout's boot
 * script starts and ends it (so it plays in full even while this code is
 * still downloading). This only takes its markup away once it has ended, or
 * straight away when there is none to play.
 *
 * After that, a click through to a drip page can bring up the route loader,
 * but only while that page is genuinely still loading.
 */
export function LoaderProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [introDone, setIntroDone] = useState(false);
  // A click through to a drip: the page it left from (the trip is over once
  // the address has moved on) and a number, so each trip gets a fresh loader.
  const [trip, setTrip] = useState<{ from: string; id: number } | null>(null);

  const finishTrip = useCallback(() => setTrip(null), []);

  useEffect(() => {
    const root = document.documentElement;
    const done = () => setIntroDone(true);
    if (!root.classList.contains("intro-pending") && !root.classList.contains("intro-leaving")) {
      const frame = requestAnimationFrame(done);
      return () => cancelAnimationFrame(frame);
    }
    window.addEventListener("nd:intro-end", done, { once: true });
    return () => window.removeEventListener("nd:intro-end", done);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // A new tab, a download or a modified click is not a trip from here.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement)) return;
      if ((link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      if (link.origin !== window.location.origin || !DRIP_PAGE.test(link.pathname)) return;
      if (link.pathname === window.location.pathname) return;
      const from = window.location.pathname;
      setTrip((t) => ({ from, id: (t?.id ?? 0) + 1 }));
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <>
      {/* Ahead of the page in the markup, so the first paint that can show
          anything already includes it. */}
      {!introDone && <IntroLoader />}
      {trip && <RouteLoader key={trip.id} arrived={pathname !== trip.from} onDone={finishTrip} />}
      {children}
    </>
  );
}
