"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { useScrollCraft, type SiteMotion } from "@/components/site/scroll/useScrollCraft";
import { mountHome, type BuildDrip } from "./motion";

/**
 * The landing page's root: the server draws every section, and this mounts
 * the scroll-craft engine and the page's own motion on them (./motion.ts),
 * removing both on navigation. Before the script runs, and under reduced
 * motion, the page is exactly what the server drew.
 */
export function HomeMotion({
  drips,
  fallback,
  children,
}: {
  drips: BuildDrip[];
  fallback: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const motion = useCallback<SiteMotion>((root, engine) => mountHome(root, engine, drips, fallback), [drips, fallback]);
  useScrollCraft(ref, motion);
  return (
    <div ref={ref} className="nd-home">
      <span data-sc-progress="" />
      {children}
    </div>
  );
}
