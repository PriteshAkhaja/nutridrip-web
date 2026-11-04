import type { ScrollCraftApi } from "@/components/site/scroll/engine";
import { fitBands, scaleLabels } from "@/components/site/v3/glass";
import { createLiquid } from "@/components/site/v3/liquid";

/**
 * The drip page's own motion, ported from the approved prototype
 * (scrollcraft/builds/drip-v3/page.js) and run by DripMotion through
 * useScrollCraft: the client's reading fill, with our bottles. Each ingredient
 * row lights once its top passes 62% of the screen. When one that goes in the
 * bag lights, its labelled bottle appears over the bag, holds a beat and drops
 * in; as it lands the liquid rises by its share and the label prints its row.
 * What is given separately stands beside the bag. The count shows how many
 * rows have been read. The engine draws the reading bar. Every listener,
 * timer, loop and class it adds, the returned cleanup removes.
 */
export function mountDrip(root: HTMLElement, engine: () => Promise<ScrollCraftApi>): () => void {
  const $ = <T extends Element = HTMLElement>(s: string, c: ParentNode = root) => c.querySelector<T>(s);
  const $$ = <T extends Element = HTMLElement>(s: string, c: ParentNode = root) => [...c.querySelectorAll<T>(s)];
  // The prototype put the page's state on <body>; here it goes on the site
  // wrapper, and comes off again in cleanup.
  const site = root.closest<HTMLElement>(".sc-site") ?? root;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = matchMedia("(max-width: 860px)").matches;

  const rows = $$("[data-ing]");
  const bag = $("[data-dp-bag]");
  const count = $("[data-dp-count]");
  if (!rows.length || !bag || !count) return () => {};
  const col = $(".dp__bagcol");
  const list = $("[data-ings]");
  const glasses = $$(".dp__glass");
  const sides = $$(".dp__side");
  const kind = (r: HTMLElement) => r.getAttribute("data-kind");
  const keyOf = (r: HTMLElement) => Number(r.getAttribute("data-k"));
  const inBag = rows.filter((r) => kind(r) === "bag").length;

  let dead = false;
  const off: Array<() => void> = [];
  function on(t: EventTarget, type: string, fn: (e: Event) => void, opts?: AddEventListenerOptions) {
    t.addEventListener(type, fn, opts);
    off.push(() => t.removeEventListener(type, fn, opts));
  }
  if (reduce) site.classList.add("is-static");

  // ---------------------------------------------------- the liquid
  // As the prototype's: a little slower to settle than the landing's, and
  // round drops. It ticks only while something moves.
  const liquid = createLiquid(bag, { ease: 0.92, every: 110, stretch: false });
  let raf = 0;
  function loop(now: number) {
    raf = 0;
    if (dead) return;
    if (liquid.tick(now)) raf = requestAnimationFrame(loop);
  }

  // ---------------------------------------------------- reading
  const state = rows.map(() => ({ lit: false, landed: false }));
  const printLine = (key: string, lit: boolean) => $(`[data-line="${key}"]`)?.classList.toggle("is-on", lit);
  function level() {
    const landed = state.filter((s, i) => s.landed && kind(rows[i]) === "bag").length;
    const to = inBag ? landed / inBag : 0;
    if (reduce) liquid.snap(to);
    else {
      liquid.set(to);
      if (!raf) raf = requestAnimationFrame(loop);
    }
  }
  function land(i: number) {
    state[i].landed = true;
    printLine(String(keyOf(rows[i])), true);
    level();
  }
  // The bottles drop one at a time, in reading order: a fast scroll lights
  // several rows at once, and dropped together their bottles stacked over the
  // bag while the liquid waited for all of them (the user's report). So the
  // drops wait for the reader to pause (140 ms without a new row). Then
  // everything read in that burst goes into the bag at once, the liquid easing
  // up to it, and only the latest bottle makes the visible fall. Read slowly,
  // one row at a time, and every bottle falls.
  let queue: number[] = [];
  let running = -1;
  let timers: number[] = [];
  let settle = 0;
  function pumpSoon() {
    clearTimeout(settle);
    settle = window.setTimeout(pump, reduce ? 0 : 140);
  }
  function pump() {
    if (dead || running >= 0 || !queue.length) return;
    while (queue.length > 1) land(queue.shift()!);
    const i = queue.shift()!;
    const g = glasses[keyOf(rows[i])];
    if (reduce || !g) {
      land(i);
      return;
    }
    running = i;
    glasses.forEach((x) => x.classList.remove("is-in"));
    void g.offsetWidth; // restart the drop's animation
    g.classList.add("is-in");
    timers = [
      window.setTimeout(() => land(i), 900), // as the bottle reaches the bag
      window.setTimeout(() => {
        running = -1;
        pump();
      }, 1000),
    ];
  }
  function changed(i: number, lit: boolean) {
    const r = rows[i];
    const k = keyOf(r);
    if (kind(r) === "carrier") printLine("c", lit);
    if (kind(r) === "sep") {
      sides[k]?.classList.toggle("is-on", lit);
      printLine(
        "s",
        rows.some((x, j) => kind(x) === "sep" && state[j].lit)
      );
    }
    if (kind(r) !== "bag") return;
    if (lit) {
      if (!state[i].landed && !queue.includes(i) && running !== i) queue.push(i);
      pumpSoon();
      return;
    }
    // Read back up past it: out of the queue, its bottle gone, its share drained.
    queue = queue.filter((q) => q !== i);
    if (running === i) {
      timers.forEach(clearTimeout);
      running = -1;
    }
    glasses[k]?.classList.remove("is-in");
    state[i].landed = false;
    printLine(String(k), false);
    level();
    pumpSoon();
  }
  function render() {
    const line = innerHeight * 0.62;
    let n = 0;
    rows.forEach((r, i) => {
      const lit = reduce || r.getBoundingClientRect().top < line;
      if (lit !== state[i].lit) {
        state[i].lit = lit;
        r.classList.toggle("is-lit", lit);
        changed(i, lit);
      }
      if (lit) n++;
    });
    count!.textContent = String(n);
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
  }
  on(window, "scroll", onScroll, { passive: true });
  on(window, "resize", () => {
    measure();
    onScroll();
  });
  // Each band is fitted once the fonts are in; a face that finishes after
  // "ready" (a slow first visit) refits too.
  document.fonts?.ready.then(() => {
    if (dead) return;
    fitBands(root);
    measure();
  });
  if (document.fonts) on(document.fonts, "loadingdone", () => !dead && fitBands(root));
  if (document.readyState !== "complete") on(window, "load", measure);

  measure();
  fitBands(root);
  render();
  stickyTick();
  site.classList.add("nd-js");
  engine().catch(() => {
    // Unmounted before the engine loaded: nothing was started.
  });

  return () => {
    dead = true;
    cancelAnimationFrame(raf);
    clearTimeout(settle);
    timers.forEach(clearTimeout);
    off.forEach((f) => f());
    site.classList.remove("nd-js", "is-static");
  };
}
