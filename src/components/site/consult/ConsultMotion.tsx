"use client";

import { useRef, type ReactNode } from "react";
import { useScrollCraft, type SiteMotion } from "@/components/site/scroll/useScrollCraft";

/** The Ask a clinician page's root: only the engine (reading bar, entry reveals). */
const mountConsult: SiteMotion = (_root, engine) => {
  engine().catch(() => {
    // Unmounted before the engine loaded: nothing was started.
  });
  return () => {};
};

export function ConsultMotion({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollCraft(ref, mountConsult);
  return (
    <div ref={ref} className="nd-consult">
      <span data-sc-progress="" />
      {children}
    </div>
  );
}
