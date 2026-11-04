"use client";

import { useRef, type ReactNode } from "react";
import { useScrollCraft, type SiteMotion } from "@/components/site/scroll/useScrollCraft";

/**
 * The For clinics page's root: only the engine (reading bar, entry reveals).
 * The order's cards stack by CSS alone (position: sticky), so there is no
 * page script to undo.
 */
const mountClinics: SiteMotion = (_root, engine) => {
  engine().catch(() => {
    // Unmounted before the engine loaded: nothing was started.
  });
  return () => {};
};

export function ClinicsMotion({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useScrollCraft(ref, mountClinics);
  return (
    <div ref={ref} className="nd-clinics">
      <span data-sc-progress="" />
      {children}
    </div>
  );
}
