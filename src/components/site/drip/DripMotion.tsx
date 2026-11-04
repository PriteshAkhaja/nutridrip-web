"use client";

import { useRef, type CSSProperties, type ReactNode } from "react";
import { useScrollCraft } from "@/components/site/scroll/useScrollCraft";
import { mountDrip } from "./motion";

/**
 * The drip page's root: the server draws every section, and this mounts the
 * scroll-craft engine (the reading bar) and the page's own motion
 * (./motion.ts), removing both on navigation. Before the script runs, and
 * under reduced motion, the page is what the server drew.
 */
export function DripMotion({ tint, children }: { tint: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollCraft(ref, mountDrip);
  return (
    <div ref={ref} className="nd-drip" style={{ "--tint": tint } as CSSProperties}>
      <span data-sc-progress="" />
      {children}
    </div>
  );
}
