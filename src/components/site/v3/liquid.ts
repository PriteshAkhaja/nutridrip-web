/**
 * The liquid in a bag, shared by the landing's build (home/motion.ts) and the
 * drip page's companion bag (drip/motion.ts). The page says where the level
 * is going (set); each tick the level eases part of the way there, so a jerky
 * wheel still pours smoothly. While it rises, drops fall from the top of the
 * bag; each one that lands rings the surface and rocks it, a damped swing
 * that settles by itself. Markup: LiquidFill.tsx; styles: styles/glass.css.
 */

type Drop = { el: HTMLElement; x: number; y: number; v: number };
type Ring = { el: HTMLElement; x: number; born: number };

export type LiquidOptions = {
  /** The share of the gap left after one frame (0.9: a tenth closes each frame). */
  ease?: number;
  /** Milliseconds between drops while the level rises. */
  every?: number;
  /** Drops stretch as they speed up. */
  stretch?: boolean;
};

export type Liquid = {
  /** Where the level is going, 0 to 1. */
  set(to: number): void;
  /** Straight to a level, no easing (reduced motion). */
  snap(to: number): void;
  /** One frame; true while anything still moves. */
  tick(now: number): boolean;
  /** Reads the bag's height again (on resize). */
  measure(): void;
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function createLiquid(
  bag: HTMLElement,
  { ease = 0.9, every = 105, stretch = true }: LiquidOptions = {}
): Liquid {
  const levelEl = bag.querySelector<HTMLElement>("[data-liq-level]");
  const waveEls = [...bag.querySelectorAll<HTMLElement>(".liq__wave")];
  const dropEls = [...bag.querySelectorAll<HTMLElement>(".liq__drop")];
  const ringEls = [...bag.querySelectorAll<HTMLElement>(".liq__ring")];
  const liq = {
    to: 0,
    lvl: 0,
    tilt: 0,
    tiltV: 0,
    amp: 0.22,
    t: 0,
    next: 0,
    drops: [] as Drop[],
    rings: [] as Ring[],
    still: false,
  };
  let bagH = bag.offsetHeight;
  // px from the bag's top: the liquid spans 7% to 86.5% of the bag.
  const surfaceY = () => bagH * (0.07 + (1 - liq.lvl) * 0.795);

  function paint(now: number) {
    if (!levelEl) return;
    const y = surfaceY();
    levelEl.style.transform = `translate3d(0,${y.toFixed(2)}px,0) rotate(${liq.tilt.toFixed(3)}deg)`;
    waveEls.forEach((w) => {
      w.style.transform = `scaleY(${liq.amp.toFixed(3)})`;
      w.style.opacity = String(Math.min(1, liq.lvl * 30));
    });
    liq.drops.forEach((d) => {
      const s = stretch ? ` scaleY(${(1 + Math.min(0.5, (d.v / bagH) * 30)).toFixed(3)})` : "";
      d.el.style.transform = `translate3d(${d.x.toFixed(1)}px,${d.y.toFixed(1)}px,0)${s}`;
    });
    liq.rings.forEach((r) => {
      const k = (now - r.born) / 480;
      r.el.style.transform = `translate3d(${r.x.toFixed(1)}px,${y.toFixed(1)}px,0) scale(${(0.35 + k * 1.1).toFixed(3)})`;
      r.el.style.opacity = String(Math.max(0, 0.85 * (1 - k)));
    });
  }

  function tick(now: number) {
    if (!bagH) return false;
    const f = liq.t ? Math.min(4, (now - liq.t) / 16.7) : 1;
    liq.t = now;
    liq.lvl += (liq.to - liq.lvl) * (1 - Math.pow(ease, f));
    if (Math.abs(liq.to - liq.lvl) < 0.0004) liq.lvl = liq.to;
    const rising = liq.to - liq.lvl > 0.003;
    liq.tiltV += (-0.035 * liq.tilt - 0.09 * liq.tiltV) * f;
    liq.tilt = clamp(liq.tilt + liq.tiltV * f, -2.5, 2.5);
    liq.amp += ((rising ? 1 : 0.22) - liq.amp) * (1 - Math.pow(0.94, f));
    if (rising && now >= liq.next && liq.lvl < 0.98) {
      const free = dropEls.find((el) => !liq.drops.some((d) => d.el === el));
      if (free) {
        liq.drops.push({ el: free, x: (Math.random() - 0.5) * bagH * 0.014, y: bagH * 0.075, v: bagH * 0.002 });
        free.style.opacity = "0.95";
      }
      liq.next = now + every;
    }
    const surf = surfaceY();
    liq.drops = liq.drops.filter((d) => {
      d.v += bagH * 0.0012 * f;
      d.y += d.v * f;
      if (d.y < surf - bagH * 0.01) return true;
      d.el.style.opacity = "0";
      const ring = ringEls.find((el) => !liq.rings.some((r) => r.el === el));
      if (ring) liq.rings.push({ el: ring, x: d.x, born: now });
      liq.tiltV += (Math.random() < 0.5 ? -1 : 1) * 0.06;
      return false;
    });
    liq.rings = liq.rings.filter((r) => {
      if (now - r.born < 480) return true;
      r.el.style.opacity = "0";
      return false;
    });
    const still =
      !rising &&
      !liq.drops.length &&
      !liq.rings.length &&
      Math.abs(liq.tilt) < 0.004 &&
      Math.abs(liq.tiltV) < 0.0004 &&
      Math.abs(liq.amp - 0.22) < 0.002 &&
      liq.lvl === liq.to;
    if (still && liq.still) {
      // Nothing moved since the last paint. The next pour starts from a fresh
      // frame, not from the time since this one (the drip page stops ticking).
      liq.t = 0;
      return false;
    }
    liq.still = still;
    paint(now);
    return true;
  }

  return {
    set(to) {
      liq.to = to;
    },
    snap(to) {
      liq.to = to;
      liq.lvl = to;
      paint(0);
    },
    tick,
    measure() {
      bagH = bag.offsetHeight;
      paint(performance.now());
    },
  };
}
