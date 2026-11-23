import type { ScrollCraftApi } from "@/components/site/scroll/engine";
import { fitBands, scaleLabels } from "@/components/site/v3/glass";
import { createLiquid } from "@/components/site/v3/liquid";
import {
  BLOOM_MS,
  PORT,
  READ_LINE,
  bagLevel,
  bloomPose,
  bottlePose,
  shelfCue,
  portAim,
  portRing,
  sepPose,
  stepQueue,
  smooth,
  type Geometry,
  type Pose,
} from "./build-math";
import { mountStand } from "./stand";

/**
 * The drip page's own motion (DripPage), run by DripMotion through
 * useScrollCraft. The page scrolls as it always did, and the bag beside the
 * list stays (sticky), with the drip's bottles floating on its left. Each
 * ingredient row lights once its top passes the reading line, as on the
 * original page, and its bottle joins a queue: one bottle at a time leaves the
 * shelf, docks under the bag's medication port and goes in (a ring closing
 * around the port), its colour blooming up into the liquid, the level rising
 * by its share and the label printing its line (./build-math.ts stepQueue,
 * bottlePose, portRing, bloomPose). Read back up and the bottles come out again, last first. What
 * is given beside the bag stays on its shelf. Then ./stand.ts moves the stand and the
 * morning. The engine draws the reading bar. Every listener, timer, loop and
 * class it adds, the returned cleanup removes.
 */
export function mountDrip(root: HTMLElement, engine: () => Promise<ScrollCraftApi>): () => void {
  const $ = <T extends Element = HTMLElement>(s: string, c: ParentNode = root) => c.querySelector<T>(s);
  const $$ = <T extends Element = HTMLElement>(s: string, c: ParentNode = root) => [...c.querySelectorAll<T>(s)];
  // The page's state goes on the site wrapper, and comes off again in cleanup.
  const site = root.closest<HTMLElement>(".sc-site") ?? root;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = matchMedia("(max-width: 860px)").matches;

  const rows = $$("[data-ing]");
  const bag = $("[data-dp-bag]");
  if (!rows.length || !bag) return () => {};
  const col = $(".dp__bagcol");
  const rig = $(".dp__rig");
  const list = $("[data-ings]");
  const kind = (r: HTMLElement) => r.getAttribute("data-kind");
  const keyOf = (r: HTMLElement) => Number(r.getAttribute("data-k"));
  const bottles = $$("[data-rb]");
  const sides = $$("[data-rs]");

  let dead = false;
  const off: Array<() => void> = [];
  function on(t: EventTarget, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions) {
    t.addEventListener(type, fn, opts);
    off.push(() => t.removeEventListener(type, fn, opts));
  }
  if (reduce) site.classList.add("is-static");

  // ---------------------------------------------------- the liquid
  const liquid = createLiquid(bag, { ease: 0.92, every: 110, stretch: false });
  let raf = 0;
  let lastLevel = -1;
  function loop(now: number) {
    raf = 0;
    if (dead) return;
    if (liquid.tick(now)) raf = requestAnimationFrame(loop);
  }
  function setLevel(v: number) {
    // The stand's copy of the bag reads this, so it carries on at the same level.
    bag!.dataset.level = v.toFixed(3);
    if (reduce) {
      liquid.snap(v);
      return;
    }
    if (Math.abs(v - lastLevel) < 0.002) return;
    lastLevel = v;
    liquid.set(v);
    if (!raf) raf = requestAnimationFrame(loop);
  }

  // ---------------------------------------------------- the shelf
  // Each bottle's way from the shelf to the bag's medication port, measured with every
  // transform off. Both live in the sticky column, so the way does not change
  // as the page scrolls.
  let geo: Geometry[] = [];
  // Each bottle's band colour: its ring and its bloom take it.
  const colourOf = bottles.map(
    (b) => b.querySelector<HTMLElement>(".vial__glass")?.style.getPropertyValue("--band").trim() || ""
  );
  const ring = $("[data-port]");
  // The glow behind a bottle as its turn comes takes its colour.
  bottles.forEach((b, k) => colourOf[k] && b.style.setProperty("--c", colourOf[k]));
  // The bag's box (untransformed), for the blooms: they are drawn in it.
  let bagBox = { w: 0, h: 0 };
  function measureShelf() {
    if (!rig) return;
    [...bottles, ...sides].forEach((b) => (b.style.transform = ""));
    const rr = rig.getBoundingClientRect();
    const br = bag!.getBoundingClientRect();
    const port = {
      x: br.left - rr.left + PORT.x * br.width,
      y: br.top - rr.top + PORT.y * br.height,
    };
    if (ring) {
      ring.style.left = `${port.x.toFixed(1)}px`;
      ring.style.top = `${port.y.toFixed(1)}px`;
    }
    bagBox = { w: bag!.offsetWidth, h: bag!.offsetHeight };
    geo = bottles.map((b) => {
      const r = b.getBoundingClientRect();
      // From its neck: the top centre of its box, where it scales from.
      const neck = { x: r.left - rr.left + r.width / 2, y: r.top - rr.top };
      return { ...portAim(port, neck), arc: Math.min(40, r.height * 0.4) };
    });
  }

  // ---------------------------------------------------- the blooms
  // As a bottle goes in, its colour clouds up into the liquid from the port:
  // three clouds, each swirling its own way, rising into what is there and
  // thinning out into it. Timed, not scrolled (the colour is gone into the
  // liquid by the time anyone could scroll back), and only forwards.
  const clouds = $$(".liq__bloom", bag);
  type Bloom = { born: number; els: HTMLElement[]; rise: number; spread: number };
  let blooms: Bloom[] = [];
  let braf = 0;
  function bloomLoop(now: number) {
    braf = 0;
    if (dead) return;
    // In the liquid's box: the port's end is under it, at the liquid's foot.
    const x0 = PORT.x * bagBox.w;
    const y0 = 0.865 * bagBox.h;
    blooms = blooms.filter((b) => {
      const k = (now - b.born) / BLOOM_MS;
      b.els.forEach((el, j) => {
        const p = bloomPose(k, j, b.rise, b.spread);
        el.style.transform = `translate3d(${(x0 + p.x).toFixed(1)}px,${(y0 + p.y).toFixed(1)}px,0) scale(${p.scale.toFixed(3)})`;
        el.style.opacity = p.opacity.toFixed(3);
      });
      if (k < 1) return true;
      b.els.forEach((el) => (el.style.opacity = "0"));
      return false;
    });
    if (blooms.length) braf = requestAnimationFrame(bloomLoop);
  }
  function bloom(colour: string, level: number) {
    if (reduce || clouds.length < 3 || !bagBox.h) return;
    const used = new Set(blooms.flatMap((b) => b.els));
    const els = clouds.filter((c) => !used.has(c)).slice(0, 3);
    if (els.length < 3) return;
    els.forEach((el) => el.style.setProperty("--c", colour || "var(--tint)"));
    // Up through about half the liquid there will be, and swinging across a
    // third of the bag.
    const depth = 0.795 * Math.max(0.15, level) * bagBox.h;
    blooms.push({ born: performance.now(), els, rise: depth * 0.6, spread: bagBox.w * 0.16 });
    if (!braf) braf = requestAnimationFrame(bloomLoop);
  }
  const tf = (el: HTMLElement, pose: Pose) => {
    el.style.transform = `translate3d(${pose.x.toFixed(1)}px,${pose.y.toFixed(1)}px,0) rotate(${pose.rotate.toFixed(1)}deg) scale(${pose.scale.toFixed(3)})`;
    el.style.opacity = String(Math.round(pose.opacity * 1000) / 1000);
    el.style.setProperty("--cue", (pose.glow ?? 0).toFixed(3));
  };

  // ---------------------------------------------------- reading
  // Every row, in reading order, with its progress t: 0 on the shelf, 1 done
  // (poured; for what is given separately, gone from the shelf: it never goes
  // in the bag, and the label prints it apart). A row being read sets its
  // target to 1, read back up past it to 0, and the queue (build-math
  // stepQueue) moves one item at a time towards its target, so the reader
  // always sees a single bottle move, however fast the page is scrolled.
  const items = rows.map((r, i) => ({ i, kind: kind(r), k: keyOf(r) }));
  // The carrier is the bag filling itself, and a separate bottle only fades:
  // both quicker than a bottle going in.
  const itemMs = items.map((x) => (x.kind === "bag" ? 1500 : x.kind === "sep" ? 600 : 500));
  let ts: number[] = items.map(() => (reduce ? 1 : 0));
  const targets: number[] = items.map(() => 0);
  const lit = rows.map(() => false);
  // Each row's cue (shelfCue): its bottle lifts and lights as its turn comes.
  const cues: number[] = rows.map(() => 0);
  const printed = new Map<string, boolean>();
  function print(key: string, v: boolean) {
    if (printed.get(key) === v) return;
    printed.set(key, v);
    $(`[data-line="${key}"]`)?.classList.toggle("is-on", v);
  }
  // Each bottle's last pour, so a bloom starts as one begins to go in (forwards only).
  const lastPour: number[] = bottles.map(() => (reduce ? 1 : 0));
  let ringFor = -1;
  // Draws every item at its current progress.
  function draw() {
    let carrier = 0;
    const pours: number[] = [];
    let sepOn = false;
    let started = -1;
    let moving = -1;
    items.forEach((x, j) => {
      const t = ts[j];
      if (x.kind === "carrier") {
        carrier = smooth(t);
        print("c", t >= 0.5);
        return;
      }
      if (x.kind === "sep") {
        if (sides[x.k] && !reduce) tf(sides[x.k], sepPose(t));
        if (t >= 0.5) sepOn = true;
        return;
      }
      const pose = bottlePose(t, geo[x.k] ?? { dx: 0, dy: 0, arc: 0 }, cues[x.i]);
      if (bottles[x.k] && !reduce) tf(bottles[x.k], pose);
      pours.push(pose.poured);
      print(String(x.k), t >= 0.78);
      if (pose.poured > 0.04 && lastPour[x.k] <= 0.04) started = x.k;
      lastPour[x.k] = pose.poured;
      if (t > 0 && t < 1) moving = j;
    });
    print("s", sepOn);
    const level = bagLevel(carrier, pours);
    setLevel(level);
    if (started >= 0) bloom(colourOf[started], level);
    // The ring at the port, with the one bottle under way (one at a time).
    if (ring && !reduce) {
      const x = moving >= 0 ? items[moving] : null;
      if (x && x.k !== ringFor) {
        ringFor = x.k;
        ring.style.setProperty("--c", colourOf[x.k] || "");
      }
      // Not once the scene is under way: the bag it belongs to has handed over
      // and is on its way to the stand, and the ring would be left behind.
      const r = x && !hurry ? portRing(ts[moving]) : { scale: 1, opacity: 0 };
      ring.style.transform = `scale(${r.scale.toFixed(3)})`;
      ring.style.opacity = r.opacity.toFixed(3);
    }
  }
  // Once the stand scene is under way the page's bag has handed over and the
  // shelf is being pushed away, so a pour still going (a scroll faster than the
  // pours) finishes at once rather than being carried off mid-air.
  const hurriedMs = itemMs.map((m) => m / 8);
  let hurry = false;
  let qraf = 0;
  let last = 0;
  function tick(now: number) {
    qraf = 0;
    if (dead) return;
    const dt = last ? Math.min(64, now - last) : 16;
    last = now;
    const r = stepQueue(ts, targets, dt, hurry ? hurriedMs : itemMs);
    ts = r.ts;
    draw();
    if (r.active >= 0) qraf = requestAnimationFrame(tick);
    else last = 0;
  }
  function kick() {
    if (reduce) {
      ts = targets.slice();
      draw();
      return;
    }
    if (!qraf) qraf = requestAnimationFrame(tick);
  }
  // ---------------------------------------------------- the hold
  // Once the list's last card reaches the foot of the screen, the reading
  // column stops there: CSS sticky (.dp__hold, through the room under it), so
  // the browser holds it in the same frame as the scroll. Moving it from here
  // instead lands a frame late, and the list shakes on every notch. The rows
  // are read where they would be had the list gone on scrolling (their place on
  // the layout), so the remaining bottles go in, one per scroll, with the list
  // in view; then the stand scene takes over.
  const main = $(".dp--build .dp__main");
  const holdEl = $("[data-hold]");
  const lastRow = rows[rows.length - 1];
  let rowAt: number[] = rows.map(() => Infinity);
  function measureHold() {
    if (!holdEl) return;
    // On the layout: not stuck, and not pushed by the stand (stand.ts).
    const tf = main?.style.transform ?? "";
    holdEl.style.position = "static";
    if (main) main.style.transform = "";
    rowAt = rows.map((r) => r.getBoundingClientRect().top + scrollY);
    if (!reduce) {
      // The card's foot a little above the screen's (svh: where a phone's
      // toolbar comes and goes, it does not move).
      const d = lastRow.getBoundingClientRect().bottom - holdEl.getBoundingClientRect().top;
      holdEl.style.top = `calc(100svh - ${d.toFixed(1)}px - max(32px, 6svh))`;
    }
    holdEl.style.position = reduce ? "" : "sticky";
    if (main) main.style.transform = tf;
  }

  const stage = $("[data-st]");
  function render() {
    const H = innerHeight;
    // The scene starts as its top passes the top of the screen (stand.ts).
    hurry = !!stage && stage.getBoundingClientRect().top < 0;
    let cued = false;
    rows.forEach((r, i) => {
      const on = reduce || rowAt[i] - scrollY < H * READ_LINE;
      if (on !== lit[i]) {
        lit[i] = on;
        r.classList.toggle("is-lit", on);
      }
      const c = reduce ? 0 : Math.round(shelfCue(rowAt[i] - scrollY, H) * 1000) / 1000;
      if (c !== cues[i]) {
        cues[i] = c;
        cued = true;
      }
    });
    items.forEach((x, j) => (targets[j] = lit[x.i] ? 1 : 0));
    // A cue alone moves nothing in the queue: draw it here.
    if (cued) draw();
    kick();
    // On a phone the bag column runs only as far as the list (the client's rule).
    if (col && list && small && col.parentElement)
      col.style.setProperty(
        "--bagcol-h",
        `${list.getBoundingClientRect().bottom - col.parentElement.getBoundingClientRect().top + 40}px`
      );
  }

  // ---------------------------------------------------- phone sticky bar
  // Past the first screen, and not while the booking slip is in view.
  const sticky = $(".nd-sticky");
  const slip = $("#book");
  function stickyTick() {
    if (!sticky) return;
    const sr = slip?.getBoundingClientRect();
    sticky.classList.toggle(
      "is-on",
      scrollY > innerHeight * 0.6 && !(sr && sr.top < innerHeight * 0.8 && sr.bottom > 0)
    );
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      if (dead) return;
      render();
      stickyTick();
    });
  }
  function measure() {
    if (dead) return;
    liquid.measure();
    scaleLabels(root);
    measureShelf();
    measureHold();
    lastLevel = -1;
    draw();
    render();
  }
  on(window, "scroll", onScroll, { passive: true });
  on(window, "resize", measure);
  // Anything that changes the list's height (a late photo, a font) moves the rows.
  if (holdEl && "ResizeObserver" in window) {
    const ro = new ResizeObserver(() => {
      if (dead) return;
      measureHold();
      render();
    });
    ro.observe(holdEl);
    off.push(() => ro.disconnect());
  }
  // Each band is fitted once the fonts are in; a face that finishes after
  // "ready" (a slow first visit) refits too.
  document.fonts?.ready.then(() => {
    if (dead) return;
    fitBands(root);
    measure();
  });
  if (document.fonts) on(document.fonts, "loadingdone", () => !dead && fitBands(root));
  if (document.readyState !== "complete") on(window, "load", measure);
  const bagImg = bag.querySelector("img");
  if (bagImg && !bagImg.complete) on(bagImg, "load", measure);

  fitBands(root);
  measure();
  stickyTick();
  const stopStand = mountStand(root);
  site.classList.add("nd-js");
  engine().catch(() => {
    // Unmounted before the engine loaded: nothing was started.
  });

  return () => {
    dead = true;
    cancelAnimationFrame(raf);
    cancelAnimationFrame(qraf);
    cancelAnimationFrame(braf);
    [ring, ...clouds].forEach((el) => el?.removeAttribute("style"));
    off.forEach((f) => f());
    stopStand();
    // Only the motion's own styles go; the shelf's --i stays.
    [...bottles, ...sides].forEach((b) => {
      b.style.transform = "";
      b.style.opacity = "";
      b.style.removeProperty("--cue");
      b.style.removeProperty("--c");
    });
    if (holdEl) {
      holdEl.style.position = "";
      holdEl.style.top = "";
    }
    site.classList.remove("nd-js", "is-static");
  };
}
