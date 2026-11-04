"use client";

import { useRef, type ReactNode } from "react";
import { useScrollCraft, type SiteMotion } from "@/components/site/scroll/useScrollCraft";

/**
 * The Drips list is a Light page (AGENTS.md): its own motion is the grid's
 * glide (DripsBrowser). The engine adds the reading bar, the close's entry
 * and the bags' tilt under a pointer.
 */
const mountDrips: SiteMotion = (_root, engine) => {
  engine().catch(() => {
    // Unmounted before the engine loaded: nothing was started.
  });
  return () => {};
};

/** The Drips list's root: mounts the engine, and removes it on navigation. */
export function DripsMotion({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollCraft(ref, mountDrips);
  return (
    <div ref={ref} className="nd-drips">
      <span data-sc-progress="" />
      {children}
    </div>
  );
}
