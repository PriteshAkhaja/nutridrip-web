"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { useScrollCraft, type SiteMotion } from "@/components/site/scroll/useScrollCraft";
import type { SlipDrip } from "@/components/site/v3/book";
import { mountSafety, type GateState } from "./motion";

/** The Safety page's root: mounts the engine and the vitals gate, and removes both on navigation. */
export function SafetyMotion({ drips, gate, children }: { drips: SlipDrip[]; gate: GateState[]; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const motion = useCallback<SiteMotion>((root, engine) => mountSafety(root, engine, drips, gate), [drips, gate]);
  useScrollCraft(ref, motion);
  return (
    <div ref={ref} className="nd-safety">
      <span data-sc-progress="" />
      {children}
    </div>
  );
}
