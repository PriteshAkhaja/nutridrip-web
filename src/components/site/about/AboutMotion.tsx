"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { useScrollCraft, type SiteMotion } from "@/components/site/scroll/useScrollCraft";
import type { SlipDrip } from "@/components/site/v3/book";
import { mountAbout } from "./motion";

/** The About page's root: mounts the engine and the line, and removes both on navigation. */
export function AboutMotion({ drips, children }: { drips: SlipDrip[]; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const motion = useCallback<SiteMotion>((root, engine) => mountAbout(root, engine, drips), [drips]);
  useScrollCraft(ref, motion);
  return (
    <div ref={ref} className="nd-about">
      <span data-sc-progress="" />
      {children}
    </div>
  );
}
