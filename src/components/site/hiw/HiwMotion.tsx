"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { useScrollCraft, type SiteMotion } from "@/components/site/scroll/useScrollCraft";
import type { SlipDrip } from "@/components/site/v3/book";
import { mountHiw } from "./motion";

/** The How it works page's root: mounts the engine and the relay, and removes both on navigation. */
export function HiwMotion({ drips, children }: { drips: SlipDrip[]; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const motion = useCallback<SiteMotion>((root, engine) => mountHiw(root, engine, drips), [drips]);
  useScrollCraft(ref, motion);
  return (
    <div ref={ref} className="nd-hiw">
      <span data-sc-progress="" />
      {children}
    </div>
  );
}
