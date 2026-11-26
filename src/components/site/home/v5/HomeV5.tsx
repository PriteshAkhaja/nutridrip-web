"use client";

import { useLayoutEffect, useRef } from "react";
import type { HomeData } from "@/lib/data/home-v5";
import { HOME_V5_HTML } from "./port/markup";
import { mountHome } from "./port/home-v5.js";

/**
 * The home page: the markup ported from the preview (scrollcraft/builds/home-v5, `npm run home-port`), served as
 * HTML so every word is there before any script, and its script mounted over it with the app's data. Leaving the
 * page (or React's development double-mount) calls the script's destroy(), which stops everything it started and
 * puts the markup back as served.
 */
export function HomeV5({ data }: { data: HomeData }) {
  const ref = useRef<HTMLDivElement>(null);
  // A layout effect, so the still version (reduced motion, a phone held sideways) is in place before the first paint.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    return mountHome(el, data);
  }, [data]);
  return (
    <div ref={ref} className="hv5 js" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: HOME_V5_HTML }} />
  );
}
