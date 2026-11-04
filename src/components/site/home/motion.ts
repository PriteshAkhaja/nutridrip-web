import type { ScrollCraftApi } from "@/components/site/scroll/engine";
import {
  bandColours,
  fitBands as fitGlassBands,
  glassHTML,
  scaleLabels as scaleGlassLabels,
  type GlassItem,
} from "@/components/site/v3/glass";
import { createLiquid } from "@/components/site/v3/liquid";
import { SHORT_SCREEN } from "@/components/site/scroll/short-screen";

/**
 * The landing page's own motion, ported from the approved prototype
 * (scrollcraft/builds/home-v3/page.js) and run by HomeMotion through
 * useScrollCraft. The scroll-craft engine drives the acts; this adds what is
 * the page's alone: the hero's planes, the six-step line, the drip being built
 * (its glass and label from v3/glass.ts, its liquid from v3/liquid.ts, both
 * shared with the drip page), the day's timeline and the phone's sticky bar.
 * Every listener, loop and class it adds, it removes again in the cleanup it
 * returns, so a client-side navigation leaves nothing running.
 */

export type BuildItem = GlassItem;
export type BuildDrip = {
  slug: string;
  name: string;
  tint: string;
  price: number;
  duration: string;
  volume: number;
  carrier: string | null;
  inBag: BuildItem[];
  separate: Array<{ name: string; dose: string; notes: string | null }>;
};

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a), 0, 1);
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const smooth = (t: number) => t * t * (3 - 2 * t);
const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;
const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c
  );
function store(k: string, v?: string): string | null {
  try {
    if (v === undefined) return localStorage.getItem(k);
    localStorage.setItem(k, v);
  } catch {
    // Private mode: the choice is just not remembered.
  }
  return null;
}

export function mountHome(
  root: HTMLElement,
  engine: () => Promise<ScrollCraftApi>,
  drips: BuildDrip[],
  fallback: string
): () => void {
  const $ = <T extends Element = HTMLElement>(s: string, c: ParentNode = root) => c.querySelector<T>(s);
  const $$ = <T extends Element = HTMLElement>(s: string, c: ParentNode = root) => [...c.querySelectorAll<T>(s)];
  // The prototypes put the page's state on <body>; here it goes on the site
  // wrapper, and comes off again in cleanup.
  const site = root.closest<HTMLElement>(".sc-site") ?? root;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // A phone on its side takes the phone layout, as home.css does: a 932 px
  // wide screen 430 px tall cannot hold the desktop acts.
  const small = matchMedia(`(max-width: 860px), ${SHORT_SCREEN}`).matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const bySlug = new Map(drips.map((d) => [d.slug, d]));

  const hero = $("#q-what");
  const path = $(".path");
  const build = $("#build");
  const day = $("#q-day");
  const form = $("#q-inside");
  const drop = $(".drop");
  const vialBox = $("[data-vials]");
  const linesEl = $("[data-build-lines]");
  const sepEl = $("[data-build-sep]");
  const bag = $("[data-build-bag]");
  const stage = $(".build__stage");
  const endEl = $("[data-build-end]");
  const levelEl = $("[data-liq-level]");
  const hStage = $(".hero__stage");
  const pList = $(".path__steps");
  const dTrack = $(".day__track");
  const hParts = [
    ".hero__room",
    ".hero__back--1",
    ".hero__back--2",
    ".hero__head",
    ".hero__bag",
    ".hero__bagprint",
    ".hero__front",
    ".hero__light",
    ".hero__second",
    ".hero__copy",
  ].map((s) => $(s));
  if (
    !hero ||
    !path ||
    !build ||
    !day ||
    !form ||
    !drop ||
    !vialBox ||
    !linesEl ||
    !sepEl ||
    !bag ||
    !stage ||
    !endEl ||
    !levelEl ||
    !hStage ||
    !pList ||
    !dTrack ||
    hParts.some((p) => !p)
  )
    return () => {};
  const [room, back1, back2, head, hbag, hprint, front, light, second, hcopy] = hParts as HTMLElement[];

  let dead = false;
  const off: Array<() => void> = [];
  function on<K extends keyof WindowEventMap>(
    t: EventTarget,
    type: K | string,
    fn: (e: Event) => void,
    opts?: AddEventListenerOptions
  ) {
    t.addEventListener(type, fn, opts);
    off.push(() => t.removeEventListener(type, fn, opts));
  }

  // ---------------------------------------------------- clip codec fallback
  // As the client's home.js: webm where h264 will not play.
  const tv = document.createElement("video");
  if (!tv.canPlayType('video/mp4; codecs="avc1.42E01E"') && tv.canPlayType('video/webm; codecs="vp9"')) {
    $$("video[data-sc-src]").forEach((v) => {
      for (const a of ["data-sc-src", "data-sc-src-mobile"])
        v.setAttribute(a, (v.getAttribute(a) ?? "").replace(/\.mp4$/, ".webm"));
    });
  }

  // ---------------------------------------------------- prepare the acts
  if (small) {
    // The phone spans come from the markup (--span-m), the same numbers the
    // CSS reserves from first paint, so mounting moves nothing.
    [hero, path, build, day, drop].forEach((a) =>
      a.setAttribute("data-sc-span", getComputedStyle(a).getPropertyValue("--span-m").trim())
    );
    form.setAttribute("data-sc-act", "flow");
    form.removeAttribute("data-sc-span");
  }
  if (reduce) {
    [hero, path, build, day, drop, form].forEach((a) => {
      a.setAttribute("data-sc-act", "flow");
      a.removeAttribute("data-sc-span");
      a.querySelector("[data-sc-stage]")?.classList.add("sc-stage", "nd-still");
    });
    site.classList.add("is-static");
  }
  // Even in the phone layout, a phone on its side cannot hold the six steps
  // or the day's six stops on one screen: pinned, both were cut off top and
  // bottom. Those two scenes are read instead, every step shown (home.css,
  // .is-flat); the rest of the page keeps its motion.
  const short = !reduce && matchMedia(SHORT_SCREEN).matches;
  if (short) {
    [path, day].forEach((a) => {
      a.setAttribute("data-sc-act", "flow");
      a.removeAttribute("data-sc-span");
      a.querySelector("[data-sc-stage]")?.classList.add("sc-stage", "nd-still");
      a.classList.add("is-flat");
    });
  }

  // ---------------------------------------------------- the chosen drip
  function chosen() {
    const q = new URLSearchParams(location.search).get("drip");
    if (q && bySlug.has(q)) return q;
    const s = store("nd-drip");
    return s && bySlug.has(s) ? s : fallback;
  }
  const status = $("[data-pick-status]");
  function setChosen(slug: string, why?: "picker") {
    const d = bySlug.get(slug);
    if (!d) return;
    if (why) store("nd-drip", slug);
    site.style.setProperty("--tint", d.tint);
    $$("[data-chosen-name]").forEach((el) => (el.textContent = d.name));
    $$("[data-chosen-price]").forEach((el) => (el.textContent = inr(d.price)));
    $$("[data-chosen-duration]").forEach((el) => (el.textContent = d.duration));
    $$("[data-chosen-volume]").forEach((el) => (el.textContent = Number(d.volume).toLocaleString("en-IN")));
    $$("[data-chosen-carrier]").forEach((el) => (el.textContent = d.carrier || "the carrier"));
    // The chosen drip travels with every quiz link, as QuizButton's drip prop
    // does; a returning patient's link (booking, results) is left alone.
    $$<HTMLAnchorElement>("a[data-quiz-link]").forEach((a) => {
      if ((a.getAttribute("href") ?? "").startsWith("/quiz"))
        a.setAttribute("href", `/quiz?drip=${encodeURIComponent(d.slug)}`);
    });
    const more = $<HTMLAnchorElement>("[data-drip-page]");
    if (more) more.href = `/drips/${d.slug}`;
    $$(".feel").forEach((b) => b.setAttribute("aria-pressed", b.getAttribute("data-feel") === slug ? "true" : "false"));
    if (why === "picker" && status)
      status.innerHTML = `Keep scrolling to watch <b>${esc(d.name)}</b> being built. A physician confirms it after the quiz.`;
    loadBuild(d);
  }
  $$(".feel").forEach((b) => on(b, "click", () => setChosen(b.getAttribute("data-feel") ?? "", "picker")));

  // ---------------------------------------------------- the build
  let current: BuildDrip | null = null;
  let vialEls: HTMLElement[] = [];
  let lines: HTMLElement[] = [];
  const mstep = $("[data-build-mstep]");
  const sr = $("[data-build-sr]");

  // The labels on the glass (v3/glass.ts): each band fitted after the fonts
  // load, each label scaled to its glass.
  function fitBands() {
    fitGlassBands(vialBox!);
  }
  function scaleLabels() {
    scaleGlassLabels(vialBox!);
  }

  function loadBuild(d: BuildDrip) {
    current = d;
    stage!.style.setProperty("--tint", d.tint);
    const colours = bandColours(d.inBag);
    vialBox!.innerHTML = d.inBag
      .map((it, i) => `<div class="vial">${glassHTML(it, colours[i])}<span>${esc(it.name)}</span></div>`)
      .join("");
    vialEls = $$(".vial", vialBox!);
    scaleLabels();
    fitBands();
    // Two columns, name and dose, as the client's B-complex label.
    const rows: Array<[string, string]> = (
      d.carrier ? [[d.carrier, `${Number(d.volume).toLocaleString("en-IN")} mL`] as [string, string]] : []
    ).concat(d.inBag.map((i) => [i.name, i.dose] as [string, string]));
    const items = rows.map((r) => `${r[0]} ${r[1]}`);
    linesEl!.innerHTML =
      rows.map((r) => `<li><span>${esc(r[0])}</span><b>${esc(r[1])}</b></li>`).join("") +
      (d.separate.length
        ? `<li class="build__lsep">Given separately: ${d.separate.map((s) => esc(s.name)).join(", ")}</li>`
        : "");
    lines = $$("li", linesEl!);
    sepEl!.innerHTML = d.separate.length
      ? d.separate
          .map(
            (s) =>
              `<div class="sep__item"><b>${esc(s.name)} is given separately</b>Never mixed into the bag${s.notes ? `: ${esc(s.notes.toLowerCase())}` : ""}.</div>`
          )
          .join("") +
        `<div class="sep__compact"><b>Given separately</b>${d.separate
          .map((s) => esc(s.name) + (s.notes ? ` (${esc(s.notes.toLowerCase())})` : ""))
          .join(" · ")}</div>`
      : `<div class="sep__item"><b>Everything goes in the bag</b>All of it runs in one ${d.volume} mL bag, over ${esc(d.duration)}.</div><div class="sep__compact"><b>All in one bag</b>${d.volume} mL, over ${esc(d.duration)}.</div>`;
    if (sr)
      sr.textContent = `${d.name}: ${items.join(", ")}${d.separate.length ? `. Given separately: ${d.separate.map((s) => s.name).join(", ")}` : ""}.`;
    measure();
    last = {};
    if (reduce) renderBuild(1);
  }

  let target = { x: 0, y: 0 };
  let starts: Array<{ x: number; y: number; h: number }> = [];
  // The liquid (v3/liquid.ts): the scroll says where the level is going, and
  // each frame eases it part of the way there.
  const liquid = createLiquid(bag!);
  let tight = false;
  function measure() {
    liquid.measure();
    // On a short screen (1024 x 768) the closing card lands on the last steps.
    // Opacity does not move layout, so the two can be measured as laid out;
    // where they would meet, the steps leave before the card arrives.
    const sr2 = $(".build__steps")?.getBoundingClientRect();
    const er = endEl!.getBoundingClientRect();
    tight = !!sr2 && sr2.height > 0 && sr2.bottom + 12 > er.top;
    if (!vialEls.length) return;
    const saved = vialEls.map((v) => {
      const t = v.style.transform;
      v.style.transform = "none";
      return t;
    });
    const br = bag!.getBoundingClientRect();
    target = { x: br.left + br.width / 2, y: br.top + br.height * 0.07 };
    starts = vialEls.map((v) => {
      const r = v.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.bottom, h: r.height };
    });
    vialEls.forEach((v, i) => (v.style.transform = saved[i]));
  }

  function renderBuild(p: number) {
    if (!current) return;
    const n = vialEls.length;
    // Each ingredient owns an equal slice of the drop phase and falls over the
    // first 72% of it, so the bag fills ingredient by ingredient at one steady
    // pace whatever the count (the act's span grows with the count). Its share
    // of the level pours in from the moment it enters, over 90% of a slice,
    // eased in and out, so one pour runs into the next with no flat steps.
    const drop0 = 0.05;
    const drop1 = 0.6;
    const w = (drop1 - drop0) / Math.max(1, n);
    let risen = 0;
    vialEls.forEach((v, i) => {
      const a = drop0 + i * w;
      const t = seg(p, a, a + 0.72 * w);
      const s = starts[i];
      risen += smooth(seg(p, a + 0.6 * w, a + 1.5 * w));
      if (!s) return;
      const dx = target.x - s.x;
      const dy = target.y - s.y + s.h * 0.15;
      v.style.transform = `translate3d(${dx * ease(t)}px,${dy * t * t}px,0) scale(${1 - t * 0.45})`;
      v.style.opacity = String(t < 0.82 ? 1 : 1 - (t - 0.82) / 0.18);
      v.style.setProperty("--lab", String(1 - Math.min(1, t * 4)));
    });
    const fill = n ? risen / n : smooth(seg(p, drop0, drop1));
    if (reduce) liquid.snap(fill);
    else liquid.set(fill);
    const labO = seg(p, 0.58, 0.64);
    bag!.style.setProperty("--lab-o", labO.toFixed(3));
    const shown = Math.round(seg(p, 0.62, 0.78) * lines.length);
    lines.forEach((li, i) => li.classList.toggle("is-on", i < shown));
    stage!.style.setProperty("--sep-o", seg(p, 0.72, 0.8).toFixed(3));
    const flood = seg(p, 0.82, 0.9);
    stage!.style.setProperty("--flood", flood.toFixed(3));
    stage!.classList.toggle("is-flooded", flood > 0.5);
    site.classList.toggle("nd-tinted", p > 0.84);
    const endO = seg(p, 0.88, 0.96);
    stage!.style.setProperty("--end-o", endO.toFixed(3));
    endEl!.classList.toggle("is-on", endO > 0.02);
    // On a phone the closing card covers the label, so the label has left
    // (by 0.88) before the card arrives, and the two never cross-fade.
    if (small) {
      bag!.style.setProperty("--lab-o", (labO * (1 - seg(p, 0.84, 0.88))).toFixed(3));
      stage!.style.setProperty("--sep-o", (seg(p, 0.72, 0.78) * (1 - seg(p, 0.84, 0.88))).toFixed(3));
    }
    stage!.style.setProperty("--steps-o", tight ? (1 - seg(p, 0.84, 0.88)).toFixed(3) : "1");
    const idx = p < 0.6 ? 0 : p < 0.72 ? 1 : p < 0.82 ? 2 : 3;
    const steps = $$(".build__steps li");
    steps.forEach((li, i) => li.classList.toggle("is-on", i <= idx));
    if (mstep) mstep.textContent = steps[idx]?.textContent ?? "";
    stage!.setAttribute("data-sc-verify-state", [fill.toFixed(2), shown, flood.toFixed(2), endO.toFixed(2)].join("/"));
  }

  // ---------------------------------------------------- progress helper
  function prog(el: HTMLElement) {
    const r = el.getBoundingClientRect();
    const vh = innerHeight;
    const travel = r.height - vh;
    if (travel < 2) return clamp((vh - r.top) / (r.height + vh), 0, 1);
    return clamp(-r.top / travel, 0, 1);
  }

  // ---------------------------------------------------- hero
  let mx = 0;
  let my = 0;
  let tmx = 0;
  let tmy = 0;
  if (fine && !reduce)
    on(
      window,
      "pointermove",
      (e) => {
        tmx = (e as PointerEvent).clientX / innerWidth - 0.5;
        tmy = (e as PointerEvent).clientY / innerHeight - 0.5;
      },
      { passive: true }
    );
  const snap = (v: number) => {
    const r = devicePixelRatio || 1;
    return Math.round(v * r) / r;
  };
  function renderHero(p: number) {
    mx += (tmx - mx) * 0.08;
    my += (tmy - my) * 0.08;
    const vh = innerHeight;
    room.style.transform = `translate3d(${-mx * 10}px,${-p * vh * 0.04 - my * 6}px,0) scale(${1.02 + p * 0.03})`;
    back1.style.transform = `translate3d(${-mx * 16}px,${-p * vh * 0.07 - my * 8}px,0)`;
    back2.style.transform = `translate3d(${-mx * 14}px,${-p * vh * 0.06 - my * 7}px,0)`;
    const r = ease(seg(p, 0.05, 0.6));
    const dx = small ? r * 18 : r * (innerWidth * 0.16);
    head.style.transform = `translate3d(${dx - mx * 22}px,${r * (small ? vh * 0.05 : vh * 0.08) - my * 10}px,0) scale(${1 - r * 0.12})`;
    head.style.opacity = String(1 - r * 0.18);
    // The print plane takes the bag's exact transform. It has no will-change,
    // so the browser redraws its text at each scale instead of stretching a
    // bitmap; offsets are whole device pixels so the text is never resampled
    // between pixels either.
    const bt = `translate(${snap(-mx * 30 - r * (small ? 0 : innerWidth * 0.015))}px,${snap(-p * vh * 0.12 - my * 14)}px) scale(${(1 + r * 0.05).toFixed(4)})`;
    hbag.style.transform = bt;
    hprint.style.transform = bt;
    front.style.transform = `translate3d(${-mx * 60}px,${-p * vh * 0.42 - my * 24}px,0)`;
    light.style.transform = `translate3d(${p * 80 + mx * 20}px,0,0)`;
    const s = small ? ease(seg(p, 0.42, 0.62)) : ease(seg(p, 0.42, 0.72));
    second.style.opacity = String(s);
    second.style.transform = `translateY(${(1 - s) * 14}px)`;
    hcopy.style.opacity = String(1 - seg(p, 0.3, 0.45) * (small ? 1 : 0));
    hcopy.style.visibility = small && p > 0.45 ? "hidden" : "visible";
    hStage!.setAttribute("data-sc-verify-state", `${r.toFixed(2)}/${s.toFixed(2)}`);
  }

  // ---------------------------------------------------- pathway
  // The line runs between circle centres, measured, not a fraction of the
  // list: steps wrap to different heights, so a fraction misses.
  const pSteps = $$(".path__steps li");
  const pStage = $(".path__stage");
  let pCentres: number[] = [];
  function measurePath() {
    pCentres = $$(".path__n", pList!).map((c) => c.offsetTop + c.offsetHeight / 2); // the list is the offsetParent
    if (!pCentres.length) return;
    pList!.style.setProperty("--l0", `${pCentres[0]}px`);
    pList!.style.setProperty("--lh", `${pCentres[pCentres.length - 1] - pCentres[0]}px`);
  }
  function renderPath(p: number) {
    let n = Math.floor(seg(p, 0.02, 0.8) * 6 + 0.25);
    if (p > 0.02) n = Math.max(1, n);
    pSteps.forEach((li, i) => li.classList.toggle("is-on", i < n));
    if (pCentres.length) pList!.style.setProperty("--lp", `${n > 0 ? pCentres[n - 1] - pCentres[0] : 0}px`);
    pStage?.setAttribute("data-sc-verify-state", String(n));
  }

  // ---------------------------------------------------- day timeline
  const dSteps = $$(".day__steps li");
  const dayStage = $(".day__stage");
  function renderDay(p: number) {
    const t = seg(p, 0.05, 0.85);
    dTrack!.style.setProperty("--day", t.toFixed(3));
    dSteps.forEach((li, i) => li.classList.toggle("is-on", t >= i / 5 - 0.001));
    dayStage?.setAttribute("data-sc-verify-state", t.toFixed(2));
  }

  // ---------------------------------------------------- phone sticky bar
  const sticky = $(".nd-sticky");
  const slip = $("#book");
  function stickyTick() {
    if (!sticky) return;
    const after = hero!.getBoundingClientRect().bottom < innerHeight * 0.35;
    const sr3 = slip?.getBoundingClientRect();
    const atSlip = !!sr3 && sr3.top < innerHeight * 0.8 && sr3.bottom > 0;
    const br = build!.getBoundingClientRect();
    const inBuild = br.top < innerHeight * 0.5 && br.bottom > innerHeight * 0.5;
    sticky.classList.toggle("is-on", after && !atSlip && !inBuild);
  }
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      if (!dead) stickyTick();
    });
  };
  on(window, "scroll", onScroll, { passive: true });
  on(window, "resize", onScroll);

  // ---------------------------------------------------- loop
  let last: { p?: number; b?: number; d?: number; live?: boolean } = {};
  let raf = 0;
  function frame() {
    if (dead) return;
    renderHero(prog(hero!));
    const pp = short ? 1 : prog(path!);
    if (pp !== last.p) {
      renderPath(pp);
      last.p = pp;
    }
    const pb = prog(build!);
    if (pb !== last.b) {
      renderBuild(pb);
      last.b = pb;
    }
    const brr = build!.getBoundingClientRect();
    const live = brr.top < innerHeight && brr.bottom > 0;
    if (live !== last.live) {
      bag!.classList.toggle("is-live", live);
      last.live = live;
    }
    if (live) liquid.tick(performance.now());
    const pd = short ? 1 : prog(day!);
    if (pd !== last.d) {
      renderDay(pd);
      last.d = pd;
    }
    raf = requestAnimationFrame(frame);
  }
  const remeasure = () => {
    if (dead) return;
    scaleLabels();
    measure();
    measurePath();
    last = {};
  };
  on(window, "resize", remeasure);

  // ---------------------------------------------------- keyboard focus
  // The rail travels by transform, so the browser cannot bring a focused card
  // into view. Park the pan act where the card is centred, using the engine's
  // own mapping: translateX = -(overflow * (1 + extra)) * p.
  on(form, "focusin", (e) => {
    if (reduce || form.getAttribute("data-sc-act") !== "pan") return;
    const rail = $("[data-sc-pan]", form);
    const item = (e.target as HTMLElement).closest<HTMLElement>(".fcard, .formulary__lead, .formulary__end");
    if (!rail || !item) return;
    const over = rail.scrollWidth - innerWidth;
    if (over <= 0) return;
    const travel = over * (1 + (parseFloat(rail.getAttribute("data-sc-pan") ?? "") || 0));
    const want = clamp(item.offsetLeft + item.offsetWidth / 2 - innerWidth / 2, 0, travel);
    const top = form.getBoundingClientRect().top + scrollY;
    scrollTo({ top: top + (want / travel) * (form.offsetHeight - innerHeight), behavior: "instant" });
  });
  // The build's closing links only exist once the bag is sealed: a keyboard
  // user arriving on them lands on the sealed bag, not on links still at 0.
  on(endEl, "focusin", () => {
    if (reduce) return;
    const top = build.getBoundingClientRect().top + scrollY;
    scrollTo({ top: top + 0.96 * (build.offsetHeight - innerHeight), behavior: "instant" });
  });

  // ---------------------------------------------------- go
  $$(".fcard").forEach((c, i) => c.style.setProperty("--i", String(i)));
  engine()
    .then(() => {
      if (dead) return;
      setChosen(chosen());
      measurePath();
      stickyTick();
      if (reduce) {
        renderBuild(1);
        renderPath(1);
        site.classList.add("nd-tinted");
        return;
      }
      document.fonts?.ready.then(() => {
        if (dead) return;
        fitBands();
        remeasure();
      });
      // A face that finishes after "ready" (a slow first visit) refits too.
      if (document.fonts) on(document.fonts, "loadingdone", () => !dead && fitBands());
      if (document.readyState === "complete") remeasure();
      else on(window, "load", remeasure);
      raf = requestAnimationFrame(frame);
    })
    .catch(() => {
      // Unmounted before the engine loaded: nothing was started.
    });
  site.classList.add("nd-js");

  return () => {
    dead = true;
    cancelAnimationFrame(raf);
    off.forEach((f) => f());
    site.classList.remove("nd-js", "nd-tinted", "is-static");
    site.style.removeProperty("--tint");
  };
}
