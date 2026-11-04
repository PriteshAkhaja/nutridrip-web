"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { useScrollCraft, type SiteMotion } from "@/components/site/scroll/useScrollCraft";
import { mountIvTabs, type SlipDrip } from "./motion";

/** The IV vs Tablets page's root: mounts the engine and the page's motion, and removes both on navigation. */
export function IvTabsMotion({ drips, children }: { drips: SlipDrip[]; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const motion = useCallback<SiteMotion>((root, engine) => mountIvTabs(root, engine, drips), [drips]);
  useScrollCraft(ref, motion);
  return (
    <div ref={ref} className="nd-ivt">
      <span data-sc-progress="" />
      {children}
    </div>
  );
}
