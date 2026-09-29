"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

type Connection = { saveData?: boolean; effectiveType?: string };

/**
 * On a computer, once a page has finished loading and the browser is idle,
 * fetch the rest of its photographs in the background, so whatever someone
 * scrolls to is already there rather than a blurred preview still sharpening.
 * The page's own loading goes first: nothing starts before the load event.
 *
 * Phones, and any connection asking to save data or on 2G, keep loading
 * photographs only as they come near, which is what their data plans want.
 * Renders nothing; runs again for each page reached by client navigation.
 */
export function WarmPhotos() {
  const pathname = usePathname();

  useEffect(() => {
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    const connection = (navigator as Navigator & { connection?: Connection }).connection;
    if (connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? "")) return;

    let idle = 0;
    let timer = 0;
    const warm = () => {
      document.querySelectorAll<HTMLImageElement>('main img[loading="lazy"]').forEach((img) => {
        img.loading = "eager";
      });
    };
    const whenIdle = () => {
      if (typeof window.requestIdleCallback === "function") idle = window.requestIdleCallback(warm, { timeout: 2000 });
      else timer = window.setTimeout(warm, 300);
    };
    if (document.readyState === "complete") whenIdle();
    else window.addEventListener("load", whenIdle, { once: true });

    return () => {
      window.removeEventListener("load", whenIdle);
      if (idle && typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
      window.clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}
