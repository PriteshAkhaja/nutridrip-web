"use client";

import { useEffect } from "react";

/** Scroll reveals. The first screen ("hero", "settle") plays from CSS instead. */
const REVEALS = '[data-reveal]:not([data-reveal="hero"]):not([data-reveal="settle"])';

/** Continuous motion — the marquee, the drifting chips — that only needs to run on screen. */
const PAUSABLE = "[data-pause-offscreen]";

/**
 * How far below the screen something starts to arrive, as a share of the
 * screen's height, so it is well on its way by the time anyone sees it.
 */
const LEAD = 0.2;

/**
 * Scroll speed (px per ms) above which arrivals are near-instant. Nobody can
 * watch a fade go by at a fling, and what they would see is blank space
 * trailing the scroll.
 */
const FLING = 1.1;

/**
 * Two jobs, and renders nothing.
 *
 * Scroll reveals. Once the page is running, anything still below the screen
 * is held back (.rv-hold) and let in (.is-in) as it approaches, which the CSS
 * in globals.css turns into its entrance. Nothing is hidden before this runs
 * and nothing on screen is ever hidden, so scrolling while the page is still
 * loading shows the page, not gaps. Only under `.reveal-on` (motion allowed,
 * set by the root layout's boot script).
 *
 * And it pauses any endless animation while it is off screen, so a marquee
 * three screens down is not costing frames to someone reading the top.
 */
export function RevealRoot() {
  useEffect(() => {
    const root = document.documentElement;

    const pauser = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) entry.target.classList.toggle("motion-paused", !entry.isIntersecting);
      },
      // A little early, so it is already moving as it comes into view.
      { rootMargin: "120px 0px" }
    );
    const watchMotion = () => document.querySelectorAll(PAUSABLE).forEach((el) => pauser.observe(el));
    watchMotion();

    const revealing = root.classList.contains("reveal-on");

    // Scroll speed, smoothed, and only read when something arrives.
    let lastY = window.scrollY;
    let lastT = performance.now();
    let speed = 0;
    const onScroll = () => {
      const now = performance.now();
      speed = speed * 0.5 + (Math.abs(window.scrollY - lastY) / Math.max(1, now - lastT)) * 0.5;
      lastY = window.scrollY;
      lastT = now;
    };
    const flinging = () => performance.now() - lastT < 160 && speed > FLING;

    const io = new IntersectionObserver(
      (entries) => {
        const fast = flinging();
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (fast) entry.target.classList.add("rv-fast");
          entry.target.classList.add("is-in");
          io.unobserve(entry.target);
        }
      },
      {
        // Below: arrive a screen-share early. Above: whatever a jump (an
        // anchor, the End key) carried past arrives too, ready for scrolling
        // back. Sideways: a card off to one side of a rail counts as in view,
        // so a swipe or an auto-advancing rail never shows one still fading in.
        rootMargin: `100% 400% ${LEAD * 100}% 400%`,
        threshold: 0,
      }
    );

    // Everything seen for the first time is sorted once: below the screen
    // (past the lead) is held back; the rest is left exactly as painted and
    // marked as arrived. Positions are all read before any class is written,
    // so the page is laid out once, not once per element.
    const sweep = () => {
      if (!revealing) return;
      const fresh = [...document.querySelectorAll<HTMLElement>(REVEALS)].filter(
        (el) => !el.classList.contains("is-in") && !el.classList.contains("rv-hold")
      );
      if (fresh.length > 0) {
        const limit = window.innerHeight * (1 + LEAD);
        const tops = fresh.map((el) => el.getBoundingClientRect().top);
        fresh.forEach((el, i) => el.classList.add(tops[i] > limit ? "rv-hold" : "is-in"));
      }
      // Start over, so nothing that has left the page is kept alive here.
      io.disconnect();
      document.querySelectorAll(".rv-hold:not(.is-in)").forEach((el) => io.observe(el));
    };
    sweep();
    if (revealing) window.addEventListener("scroll", onScroll, { passive: true });

    // Pages reached by client navigation mount new content under the same
    // layout: sort what arrived, and let go of what left.
    const mo = new MutationObserver((records) => {
      if (!records.some((r) => r.addedNodes.length > 0 || r.removedNodes.length > 0)) return;
      sweep();
      pauser.disconnect();
      watchMotion();
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      pauser.disconnect();
      mo.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return null;
}
