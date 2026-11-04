"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { useScrollCraft, type SiteMotion } from "@/components/site/scroll/useScrollCraft";
import { mountBook, type SlipDrip } from "@/components/site/v3/book";

/** The Zones page's root: the engine (reading bar, entry reveals) and the slip; no act. */
export function ZonesMotion({ drips, children }: { drips: SlipDrip[]; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const motion = useCallback<SiteMotion>(
    (root, engine) => {
      const unbook = mountBook(root, drips);
      engine().catch(() => {
        // Unmounted before the engine loaded: nothing was started.
      });
      return unbook;
    },
    [drips]
  );
  useScrollCraft(ref, motion);
  return (
    <div ref={ref} className="nd-zones">
      <span data-sc-progress="" />
      {children}
    </div>
  );
}
