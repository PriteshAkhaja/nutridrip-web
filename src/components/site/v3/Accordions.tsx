"use client";

import { useEffect } from "react";

const MS = 300;
const EASE = "cubic-bezier(.2, .7, .2, 1)";

/**
 * Every question on the public site (`.nd-faq details`) opens and closes with
 * a glide instead of a jump: the height runs between the question alone and
 * the question with its answer, and the answer fades in or out. The details
 * element still does the work, so the answers stay readable and toggle with
 * no script, by keyboard, and under reduced motion (where this steps aside).
 * One listener for the whole site, mounted by the public layout.
 */
export function Accordions() {
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)");
    const running = new WeakMap<HTMLDetailsElement, Animation[]>();

    function run(d: HTMLDetailsElement, summary: HTMLElement, opening: boolean) {
      const body = summary.nextElementSibling as HTMLElement | null;
      // Where it is now, mid-glide included, before any running glide is dropped.
      const from = d.getBoundingClientRect().height;
      running.get(d)?.forEach((a) => a.cancel());
      d.dataset.glide = opening ? "opening" : "closing";
      d.classList.toggle("is-closing", !opening);
      d.style.overflow = "hidden";
      if (opening) d.open = true;
      const border = d.offsetHeight - d.clientHeight;
      const to = opening ? d.scrollHeight + border : summary.offsetHeight + border;
      const anims = [
        d.animate({ height: [`${from}px`, `${to}px`] }, { duration: MS, easing: EASE }),
        ...(body
          ? [
              body.animate(
                { opacity: opening ? [0, 1] : [1, 0] },
                { duration: MS * 0.8, easing: EASE, fill: "forwards" }
              ),
            ]
          : []),
      ];
      running.set(d, anims);
      anims[0].onfinish = () => {
        if (!opening) d.open = false;
        anims.forEach((a) => a.cancel());
        running.delete(d);
        delete d.dataset.glide;
        d.classList.remove("is-closing");
        d.style.overflow = "";
      };
    }

    const onClick = (e: MouseEvent) => {
      if (reduce.matches || e.defaultPrevented) return;
      const summary = (e.target as Element | null)?.closest?.<HTMLElement>(".sc-site .nd-faq details > summary");
      const d = summary?.parentElement;
      if (!summary || !(d instanceof HTMLDetailsElement)) return;
      e.preventDefault();
      // The way it is heading decides, so a second click mid-glide turns it round.
      const opening = d.dataset.glide ? d.dataset.glide === "closing" : !d.open;
      run(d, summary, opening);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  return null;
}
