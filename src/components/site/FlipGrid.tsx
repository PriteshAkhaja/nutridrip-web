"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { Flip } from "gsap/Flip";

/**
 * A grid whose items glide to their new places when a filter changes it,
 * instead of jumping. The filter stays what it is (links, so every filter is a
 * URL and it works without JavaScript): when one of the `trigger` area's links
 * is clicked, the grid records where every item is; when the server sends the
 * filtered grid, items that stayed move from there to their new place, and
 * items that are new rise in. Transforms only, and nothing under reduced
 * motion. Items carry `data-flip-id` (their key).
 */
export function FlipGrid({
  children,
  className = "",
  trigger,
}: {
  children: ReactNode;
  className?: string;
  trigger: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const state = useRef<Flip.FlipState | null>(null);

  useEffect(() => {
    gsap.registerPlugin(Flip);
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.(`${trigger} a`);
      if (!link || !ref.current || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      state.current = Flip.getState(ref.current.querySelectorAll("[data-flip-id]"));
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [trigger]);

  // After every render: if a filter click recorded the old layout, play from it.
  useLayoutEffect(() => {
    const before = state.current;
    if (!before || !ref.current) return;
    state.current = null;
    Flip.from(before, {
      targets: ref.current.querySelectorAll("[data-flip-id]"),
      duration: 0.55,
      ease: "power3.inOut",
      stagger: 0.02,
      prune: true,
      onEnter: (els) =>
        gsap.fromTo(
          els,
          { y: 28, scale: 0.98 },
          { y: 0, scale: 1, duration: 0.5, ease: "power3.out", delay: 0.12, clearProps: "transform" }
        ),
    });
  });

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
