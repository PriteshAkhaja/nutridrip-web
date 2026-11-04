/**
 * The scroll-craft engine (scrollcraft.js beside this file, copied unchanged
 * from the skill; never edit it per page). It is an IIFE that sets
 * window.ScrollCraft, so it is loaded in the browser only, on first use.
 *
 * mount(root) reads the data-sc-* acts inside root and drives them from one
 * rAF loop. Since 0.3.1 it returns an api whose destroy() undoes everything it
 * attached (window listeners, both rAF loops, the IntersectionObservers), and
 * is safe to call twice. useScrollCraft (./useScrollCraft.ts) is the only
 * place that mounts it.
 */
export type ScrollCraftApi = { destroy: () => void };

type ScrollCraftGlobal = {
  mount: (root: Element, opts?: Record<string, unknown>) => ScrollCraftApi;
  instances: ScrollCraftApi[];
};

declare global {
  interface Window {
    ScrollCraft?: ScrollCraftGlobal;
  }
}

let loading: Promise<ScrollCraftGlobal> | null = null;

export function loadScrollCraft(): Promise<ScrollCraftGlobal> {
  if (typeof window !== "undefined" && window.ScrollCraft) return Promise.resolve(window.ScrollCraft);
  loading ??= import("./scrollcraft.js").then(() => {
    if (!window.ScrollCraft) throw new Error("scrollcraft.js did not define window.ScrollCraft");
    return window.ScrollCraft;
  });
  return loading;
}
