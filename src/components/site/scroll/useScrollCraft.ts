"use client";

import { useEffect, type RefObject } from "react";
import { loadScrollCraft, type ScrollCraftApi } from "./engine";

/**
 * A page's motion: prepares its acts (phone spans, flow under reduced
 * motion), asks for the engine when ready, and returns a cleanup that removes
 * every listener, loop and class it added.
 */
export type SiteMotion = (root: HTMLElement, engine: () => Promise<ScrollCraftApi>) => () => void;

/**
 * Runs a page's motion on root and mounts the scroll-craft engine when the
 * motion asks for it. On unmount (client-side navigation, or React's dev
 * double-mount) the motion's cleanup runs and the engine is destroyed, so
 * nothing of the page keeps running on the next one. An engine still loading
 * at that point is never mounted.
 *
 * `motion` must be stable (a module-level function).
 */
export function useScrollCraft(ref: RefObject<HTMLElement | null>, motion: SiteMotion) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let api: ScrollCraftApi | null = null;
    let dead = false;
    const engine = async () => {
      const sc = await loadScrollCraft();
      if (dead) throw new Error("unmounted before the engine loaded");
      api = sc.mount(root);
      return api;
    };
    const cleanup = motion(root, engine);
    return () => {
      dead = true;
      cleanup();
      api?.destroy();
    };
  }, [ref, motion]);
}
