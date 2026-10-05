"use client";

import { useEffect, useRef, useState } from "react";

type Parsed = { prefix: string; number: number; decimals: number; grouped: boolean; suffix: string };

/** "4.9", "15 min", "6,400+", "₹8,400", "90 days": the leading number and what surrounds it. */
function parse(value: string): Parsed | null {
  const m = value.match(/^(\D*?)(\d[\d,]*(?:\.\d+)?)(.*)$/s);
  if (!m) return null;
  const [, prefix, digits, suffix] = m;
  const number = Number(digits.replaceAll(",", ""));
  if (!Number.isFinite(number)) return null;
  return { prefix, number, decimals: digits.split(".")[1]?.length ?? 0, grouped: digits.includes(","), suffix };
}

function format(p: Parsed, n: number): string {
  const body = p.grouped
    ? n.toLocaleString("en-IN", { minimumFractionDigits: p.decimals, maximumFractionDigits: p.decimals })
    : n.toFixed(p.decimals);
  return `${p.prefix}${body}${p.suffix}`;
}

/**
 * A figure that counts up from zero the first time it scrolls into view.
 *
 * The server renders the real value, and that is what a search engine, a
 * screen reader (the animated copy is aria-hidden) and anyone with reduced
 * motion get. It only animates a figure nobody has seen yet: one already on
 * screen at load keeps its value rather than dropping to zero in front of the
 * reader. The exception is a figure under the intro loader, which nobody has
 * seen either; it counts once the loader starts to leave.
 */
export function CountUp({
  value,
  duration = 1400,
  className,
}: {
  value: string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const el = ref.current;
    const parsed = parse(value);
    if (!el || !parsed || parsed.number === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const r = el.getBoundingClientRect();
    const onScreen = r.top < window.innerHeight && r.bottom > 0;
    // On the first screen, under the intro loader: nobody has seen it yet.
    const underIntro = document.documentElement.classList.contains("intro-pending");
    if (onScreen && !underIntro) return;

    // Not visible yet, so it can sit at zero until it is; set a frame later,
    // outside the effect body. Waiting for the observer instead would show the
    // real figure first and then drop it to zero in plain view.
    let raf = requestAnimationFrame(() => setShown(format(parsed, 0)));
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        io.disconnect();
        cancelAnimationFrame(raf);
        // Timed from the first frame's own timestamp, not performance.now():
        // the two clocks can disagree, and a start later than the next frame
        // would put the count below zero.
        let t0: number | undefined;
        const tick = (now: number) => {
          t0 ??= now;
          const t = Math.min(1, (now - t0) / duration);
          // Quartic ease-out: quick to rise, slow to land on the real figure.
          setShown(format(parsed, parsed.number * (1 - Math.pow(1 - t, 4))));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.35 }
    );
    // Under the intro, start watching only once it begins to leave, or the
    // count would run out of sight behind it.
    const watch = () => io.observe(el);
    if (underIntro) window.addEventListener("nd:intro-done", watch, { once: true });
    else watch();
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("nd:intro-done", watch);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      <span aria-hidden="true">{shown}</span>
      <span className="sr-only">{value}</span>
    </span>
  );
}
