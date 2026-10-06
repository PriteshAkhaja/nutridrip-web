/**
 * The drip assembles itself: the signature move of the home page (and, next,
 * the drip detail page). Ported from the approved prototype in
 * scrollcraft/builds/home-v2 (assembly.js); see its BRIEF.md for the score.
 *
 * One pinned act. GSAP ScrollTrigger maps the act to a progress p (0..1) with a
 * short scrub, so the scene glides to where the hand put it, and every frame is
 * a pure function of p and the layout. Writes transforms, opacity and a few
 * custom properties only: no blur, no filters, no clip-path animation.
 *
 *   0    .07  hero: the live headline over the drip's containers at depth
 *   .05  .20  spread: they settle into one row; names and doses arrive
 *   .24  .42  converge: one at a time, each on its own curve, to the centre
 *   .36  .48  collapse: each shrinks into the point; the ring closes; the deep ground comes up
 *   .48  .58  emerge: the bag grows out of the point, its label already printed
 *   .56  .68  fill: the carrier rises once, to the drip's own volume
 *   .68  .78  turn: one slight swing, a light band across the plastic
 *   .76  .86  callouts: two cards from the lower corners
 *   .85  1    grounded: the room rises, the bag lands on the stand's hook, the time, the quiz
 *
 * The visual layers are built here (aria-hidden); every word is server-rendered
 * by DripAssembly.tsx. Under reduced motion there is no pin and no travel: the
 * component renders three still stages and each is drawn once at a fixed p.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { AssemblyDrip, AssemblyItem } from "@/lib/data/assembly";
import { ASSEMBLY_ASSETS as A, BAG_CM, ROOM } from "./assembly-assets";

const IMG = "/images/assembly/";
const STILL_P = [0, 0.675, 1];

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const span = (p: number, a: number, b: number) => clamp((p - a) / (b - a), 0, 1);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const fmt = (n: number) => Number(n).toLocaleString("en-IN");
const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

type Box = { x0: number; y0: number; x1: number; y1: number };
type Cutout = { size: { w: number; h: number }; object: Box };
type Pt = { x: number; y: number };

/** Images that are not needed for the first screen wait for idle. */
function img(src: string, cls: string, defer: boolean, later: HTMLImageElement[]) {
  const i = new Image();
  i.alt = "";
  i.decoding = "async";
  i.className = cls;
  if (defer) {
    i.dataset.src = src;
    later.push(i);
  } else i.src = src;
  return i;
}
function vars(el: HTMLElement, m: Cutout) {
  el.style.setProperty("--w", String(m.size.w));
  el.style.setProperty("--h", String(m.size.h));
}
function px<T extends Element>(el: T, x: number, y: number, w: number, h: number): T {
  el.classList.add("px");
  const s = (el as unknown as HTMLElement).style;
  s.setProperty("--x", String(x));
  s.setProperty("--y", String(y));
  s.setProperty("--pw", String(w));
  s.setProperty("--ph", String(h));
  return el;
}
function T(el: HTMLElement | null, x: number, y: number, s?: number | null, r?: number, o?: number) {
  if (!el) return;
  el.style.transform =
    `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,0)` +
    (s != null ? ` scale(${s.toFixed(4)})` : "") +
    (r ? ` rotate(${r.toFixed(2)}deg)` : "");
  if (o != null) el.style.opacity = o.toFixed(3);
}
function bez(a: Pt, c: Pt, b: Pt, u: number): Pt {
  const v = 1 - u;
  return { x: v * v * a.x + 2 * v * u * c.x + u * u * b.x, y: v * v * a.y + 2 * v * u * c.y + u * u * b.y };
}

// ---------------------------------------------------------------- objects
type Ctr = {
  el: HTMLElement;
  m: Cutout;
  item: AssemblyItem;
  o: Pt;
  h: number;
  slot: Pt;
  hero: { x: number; y: number; s: number; r: number; a: number };
};

/** One container, in the form its stock lots record. Ampoule and Vial have
 *  stills; any other form falls back to the vial rather than to nothing. */
function container(item: AssemblyItem, later: HTMLImageElement[]): Ctr {
  const form = item.form === "Ampoule" ? "ampoule" : "vial";
  const m = A[form];
  const el = document.createElement("div");
  el.className = `obj ctr ctr--${form}`;
  vars(el, m);
  el.append(
    px(img(`${IMG}${form}-shadow.webp`, "on-light", false, later), m.shadow.x, m.shadow.y, m.shadow.w, m.shadow.h)
  );
  el.append(
    img(`${IMG}${form}.webp`, "full on-light", false, later),
    img(`${IMG}${form}-dark.webp`, "full on-dark", true, later)
  );
  const lab = px(
    document.createElement("div"),
    m.object.x0,
    m.label.y0,
    m.object.x1 - m.object.x0,
    m.label.y1 - m.label.y0
  );
  lab.classList.add("clabel");
  lab.style.setProperty("--fs", form === "ampoule" ? "25" : "44");
  lab.innerHTML = `<span>${esc(item.name)}</span>`;
  el.append(lab, img(`${IMG}${form}-sheen.webp`, "full", false, later));
  return { el, m, item, o: { x: 0, y: 0 }, h: 0, slot: { x: 0, y: 0 }, hero: { x: 0, y: 0, s: 1, r: 0, a: 1 } };
}

/** The bag: its empty and full plates on the deep ground, the photograph's own
 *  meniscus, the printed label and scale, the bag's sheen ABOVE them (so the
 *  gloss crosses the print), the turn's light band, and the lamp-lit version
 *  for the room. */
function bag(drip: AssemblyDrip, later: HTMLImageElement[]) {
  const m = A.bag;
  const f = m.fill;
  const inBag = drip.items.filter((i) => !i.separate);
  const el = document.createElement("div");
  el.className = "obj bag";
  vars(el, m);
  el.style.setProperty("--men", String(f.meniscus));

  const layer = document.createElement("div");
  layer.className = "layer on-dark";
  const clip = document.createElement("div");
  clip.className = "clip";
  clip.append(img(`${IMG}bag-dark.webp`, "full", true, later));
  layer.append(
    img(`${IMG}bag-dark-empty.webp`, "full", true, later),
    clip,
    px(img(`${IMG}bag-dark-meniscus.webp`, "men", true, later), f.strip.x, f.strip.y, f.strip.w, f.strip.h)
  );
  const room = document.createElement("div");
  room.className = "layer room";
  room.append(img(`${IMG}bag-room.webp`, "full", true, later));
  el.append(layer, room);

  // The label: inside the welded seam, below the meniscus.
  const L = { x0: 146, x1: 626, y0: m.meniscus + 64, y1: 1030 };
  const label = px(document.createElement("div"), L.x0, L.y0, L.x1 - L.x0, L.y1 - L.y0);
  label.classList.add("label");
  const carrier = drip.carrier
    ? `In ${esc(drip.carrier.name)}, ${fmt(drip.carrier.dose)} ${esc(drip.carrier.unit)}`
    : "";
  label.innerHTML =
    `<div class="label__band"><span class="mark"></span><span class="word">NutriDrip</span></div>` +
    `<div class="label__field"><p class="label__name">${esc(drip.name)}</p>` +
    (carrier ? `<p class="label__carrier">${carrier}</p>` : "") +
    `<div class="label__rule"></div><p class="label__head">Composition</p><ul class="label__list">` +
    inBag.map((i) => `<li><span>${esc(i.name)}</span><span>${fmt(i.dose)} ${esc(i.unit)}</span></li>`).join("") +
    `</ul><div class="label__foot"><span class="label__route">For intravenous use</span><span class="label__vol">${fmt(drip.volumeMl)} ml</span></div></div>`;
  el.append(label);

  // The printed graduation scale: the full volume at the meniscus.
  const S = { x0: 632, x1: 700, y0: m.meniscus, y1: m.body.y1 };
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  px(svg, S.x0, S.y0 - 14, S.x1 - S.x0, S.y1 - S.y0 + 28);
  svg.setAttribute("viewBox", `0 -14 ${S.x1 - S.x0} ${S.y1 - S.y0 + 28}`);
  svg.classList.add("scale");
  const vol = drip.volumeMl;
  const per = (S.y1 - S.y0) / vol;
  const step = vol > 600 ? 100 : 50;
  let g = "";
  for (let v = vol; v >= step; v -= step) {
    const y = (vol - v) * per;
    const major = v % (step * 2) === 0;
    g += `<line x1="${S.x1 - S.x0 - (major ? 30 : 18)}" x2="${S.x1 - S.x0}" y1="${y}" y2="${y}" stroke="currentColor" stroke-width="${major ? 3 : 2}"/>`;
    if (major)
      g += `<text x="${S.x1 - S.x0 - 36}" y="${y + 7}" text-anchor="end" font-weight="500" font-size="20" fill="currentColor">${v}</text>`;
  }
  svg.innerHTML = g;
  el.append(svg, img(`${IMG}bag-sheen.webp`, "full", true, later));
  const sweep = px(document.createElement("div"), m.body.x0, m.body.y0, m.body.x1 - m.body.x0, m.body.y1 - m.body.y0);
  sweep.classList.add("sweep");
  const band = document.createElement("i");
  sweep.append(band);
  el.append(sweep);
  return { el, band, o: { x: 0, y: 0 } };
}

// ---------------------------------------------------------------- a scene
/** One stage. Every layer is optional: a still frame holds only some. */
function scene(stage: HTMLElement, drip: AssemblyDrip, later: HTMLImageElement[], opening: Opening) {
  // A drip page has no headline to lift away: the act opens on the spread.
  const spread = opening === "spread";
  const q = <E extends Element = HTMLElement>(s: string) => stage.querySelector<E & HTMLElement>(s);
  // Only what goes into the bag becomes a container. A pre-med or a push is
  // given separately; it is named in a line under the heading ([data-asm-sep]),
  // never shown as a container left out of the merge.
  const items = drip.items.filter((i) => !i.separate);
  const n = items.length;
  const glass = q("[data-asm-glass]");
  const C = glass ? items.map((it) => container(it, later)) : [];
  C.forEach((c) => glass?.append(c.el));
  const bagHost = q("[data-asm-bag]");
  const B = bagHost ? bag(drip, later) : null;
  if (B && bagHost) bagHost.append(B.el);
  const caps = [...stage.querySelectorAll<HTMLElement>("[data-asm-cap]")];
  const el = {
    ink: q("[data-asm-ink]"),
    ring: q("[data-asm-ring]"),
    point: q("[data-asm-point]"),
    hero: q("[data-asm-hero]"),
    count: q("[data-asm-count]"),
    one: q("[data-asm-one]"),
    readout: q("[data-asm-readout]"),
    num: q("[data-asm-num]"),
    cardA: q('[data-asm-card="a"]'),
    cardB: q('[data-asm-card="b"]'),
    room: q("[data-asm-room]"),
    roomImg: q<HTMLImageElement>("[data-asm-room-img]"),
    grounded: q("[data-asm-grounded]"),
    sep: q("[data-asm-sep]"),
  };

  type G = {
    W: number;
    H: number;
    phone: boolean;
    hdr: number;
    gut: number;
    k: number;
    order: number[];
    C: Pt;
    bagH: number;
    kb: number;
    bagC: Pt;
    read: Pt;
    hook: Pt;
    roomS: number;
    roomC: Pt;
    cards: Record<"a" | "b" | "a2" | "b2", Pt>;
    groundedY: number;
  };
  let G: G | null = null;
  let mx = 0,
    my = 0;

  function headerHeight() {
    const cs = getComputedStyle(document.documentElement);
    const h = parseFloat(cs.getPropertyValue("--capsule-h")) + parseFloat(cs.getPropertyValue("--capsule-gap"));
    return Number.isFinite(h) ? h : 70;
  }

  function layout() {
    const W = stage.clientWidth,
      H = stage.clientHeight,
      phone = W <= 860;
    const hdr = headerHeight(),
      gut = phone ? 24 : 40;
    const objH = (m: Cutout) => m.object.y1 - m.object.y0;
    // The containers share one scale: they were photographed together, at true size.
    let Hv = phone ? clamp(H * 0.12, 80, 118) : clamp(H * 0.2, 120, 190);
    const slots: Array<{ x: number; base: number }> = [];
    if (phone) {
      const rows = Math.ceil(n / 2),
        top = H * 0.29,
        bottom = H * 0.97,
        rowH = (bottom - top) / rows;
      Hv = Math.min(Hv, (rowH - 58) / 1.2);
      for (let i = 0; i < n; i++) {
        const r = Math.floor(i / 2),
          c = i % 2,
          last = i === n - 1 && n % 2 === 1;
        slots.push({ x: last ? W * 0.5 : W * (c ? 0.72 : 0.28), base: top + (r + 1) * rowH - 52 });
      }
    } else {
      const slotW = Math.min(200, (W - 2 * gut - 40) / Math.max(n, 1));
      for (let j = 0; j < n; j++) slots.push({ x: W / 2 + (j - (n - 1) / 2) * slotW, base: H * 0.74 });
    }
    const k = Hv / objH(A.vial);
    // Hero poses at three depths around the headline: [x, y, scale, rotate, opacity].
    const HERO = phone
      ? [
          [0.2, 0.8, 0.95, -8, 1],
          [0.44, 0.73, 0.7, 10, 0.8],
          [0.66, 0.85, 1.05, 6, 1],
          [0.86, 0.74, 0.72, -12, 0.85],
          [0.1, 0.94, 0.6, 14, 0.6],
          [0.52, 0.96, 0.58, -6, 0.65],
          [0.92, 0.93, 0.6, 8, 0.6],
          [0.32, 0.97, 0.5, -10, 0.5],
          [0.76, 0.98, 0.5, 12, 0.5],
        ]
      : [
          [0.62, 0.42, 1.05, -6, 1],
          [0.79, 0.27, 0.72, 10, 0.78],
          [0.9, 0.63, 1.28, 8, 1],
          [0.71, 0.73, 0.86, -12, 0.92],
          [0.54, 0.8, 0.62, 14, 0.62],
          [0.94, 0.2, 0.55, -16, 0.55],
          [0.58, 0.17, 0.5, 20, 0.5],
          [0.84, 0.88, 0.66, -8, 0.7],
          [0.48, 0.52, 0.5, 6, 0.45],
        ];
    // The poses are fractions of the room the headline leaves free: to its
    // right on a wide screen, below it on a phone or tablet. Measured, so the
    // glass never crosses the words whatever the width or the copy.
    const sr = stage.getBoundingClientRect();
    let heroRight = 0,
      heroBottom = 0;
    el.hero?.querySelectorAll("*").forEach((n) => {
      const r = n.getBoundingClientRect();
      if (r.width && r.height) {
        heroRight = Math.max(heroRight, r.right - sr.left);
        heroBottom = Math.max(heroBottom, r.bottom - sr.top);
      }
    });
    const xr = phone ? [0, W] : [Math.max(heroRight + 48, W * 0.46), W - 24];
    const yr = phone ? [Math.max(heroBottom + 48, H * 0.6), H - 24] : [hdr + 24, H - 24];
    const fx = (f: number) => (phone ? f * W : lerp(xr[0], xr[1], (f - 0.46) / 0.5));
    const fy = (f: number) => (phone ? lerp(yr[0], yr[1], (f - 0.72) / 0.27) : lerp(yr[0], yr[1], (f - 0.15) / 0.75));
    C.forEach((c, i) => {
      const m = c.m;
      c.el.style.setProperty("--s", String(k));
      c.o = { x: ((m.object.x0 + m.object.x1) / 2) * k, y: ((m.object.y0 + m.object.y1) / 2) * k };
      c.el.style.transformOrigin = `${c.o.x}px ${c.o.y}px`;
      c.h = objH(m) * k;
      c.slot = { x: slots[i].x, y: slots[i].base - c.h / 2 };
      const hp = HERO[i % HERO.length];
      c.hero = { x: fx(hp[0]), y: fy(hp[1]), s: hp[2], r: hp[3], a: hp[4] };
    });
    // They leave outermost first, alternating sides.
    const mid = (n - 1) / 2;
    const order = items.map((_, i) => i).sort((a, b) => Math.abs(b - mid) - Math.abs(a - mid) || a - b);
    const centre = { x: W / 2, y: phone ? H * 0.55 : H * 0.53 };
    // The bag, sized by its body: at least half the screen on a phone.
    const bm = A.bag;
    const bagH = phone ? H * 0.54 : Math.min(H * 0.74, 780);
    const kb = bagH / objH(bm);
    const bagC = { x: W / 2, y: phone ? H * 0.56 : H * 0.55 };
    if (B) {
      B.el.style.setProperty("--s", String(kb));
      B.o = { x: ((bm.object.x0 + bm.object.x1) / 2) * kb, y: ((bm.object.y0 + bm.object.y1) / 2) * kb };
      B.el.style.transformOrigin = `${B.o.x}px ${B.o.y}px`;
    }
    const bo = B?.o ?? { x: 0, y: 0 };
    const read = phone
      ? { x: W - gut - 96, y: hdr + 26 }
      : {
          x: bagC.x + (bm.object.x1 - (bm.object.x0 + bm.object.x1) / 2) * kb + 28,
          y: bagC.y + (bm.meniscus - (bm.object.y0 + bm.object.y1) / 2) * kb - 14,
        };
    // The room: a cover crop placed so the stand stands at about two thirds
    // across (a little right of centre on a phone), never past an edge.
    const sc = Math.max(W / ROOM.w, H / ROOM.h);
    const offX = clamp((phone ? 0.64 : 0.7) * W - ROOM.pole * sc, W - ROOM.w * sc, 0);
    const offY = (H - ROOM.h * sc) / 2;
    if (el.roomImg) el.roomImg.style.objectPosition = `${offX.toFixed(1)}px ${offY.toFixed(1)}px`;
    const hook = { x: offX + ROOM.hook.x * sc, y: offY + ROOM.hook.y * sc };
    // The bag on the hook at its real size against the stand; the hook wire
    // sits in the top of the hanging hole.
    const roomS = (BAG_CM * ROOM.pxPerCm * sc) / bagH;
    const roomC = { x: hook.x + (bo.x - bm.hole.x * kb) * roomS, y: hook.y + (bo.y - (bm.hole.y - 22) * kb) * roomS };
    const cw = el.cardB?.offsetWidth ?? 280,
      ch = Math.max(el.cardA?.offsetHeight ?? 0, el.cardB?.offsetHeight ?? 0);
    const low = H - ch - (phone ? 24 : 40),
      top = hdr + (phone ? 12 : 20);
    const cards = {
      a: { x: gut, y: low },
      b: { x: W - gut - cw, y: low },
      a2: { x: gut, y: top },
      b2: { x: W - gut - cw, y: top },
    };
    const groundedY = phone ? 0 : Math.max(hdr + 40, H * 0.52 - (el.grounded?.offsetHeight ?? 0) / 2);
    G = { W, H, phone, hdr, gut, k, order, C: centre, bagH, kb, bagC, read, hook, roomS, roomC, cards, groundedY };
  }

  function rowSpan(y: number): readonly number[] {
    const r = A.bag.fill.rows;
    let k = 0;
    while (k < r.length && r[k][0] < y) k++;
    if (k === 0) return r[0];
    if (k >= r.length) return r[r.length - 1];
    const a = r[k - 1],
      b = r[k],
      t = (y - a[0]) / (b[0] - a[0]);
    return [y, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  }

  function render(p: number, pointer = false) {
    const g = G;
    if (!g) return;
    const { W, H } = g;
    // The deep ground comes up as the containers collapse.
    const inkT = inOut(span(p, 0.32, 0.45));
    stage.style.setProperty("--ink-t", inkT.toFixed(3));
    if (el.ink) el.ink.style.opacity = inkT.toFixed(3);

    // The hero lifts away; the count arrives after it, never on top of it.
    const hOut = easeOut(span(p, 0.02, 0.08));
    if (el.hero) {
      T(el.hero, 0, -36 * hOut, null, 0, 1 - hOut);
      el.hero.style.visibility = hOut >= 1 ? "hidden" : "visible";
    }
    const tIn = spread ? 1 : easeOut(span(p, 0.09, 0.15)),
      tOut = span(p, 0.41, 0.46);
    T(el.count, 0, 24 * (1 - tIn), null, 0, tIn * (1 - tOut));

    if (el.sep) {
      const under = (h: HTMLElement | null) => (h ? h.offsetTop + h.offsetHeight + 14 : 0);
      const a1 = tIn * (1 - span(p, 0.38, 0.42));
      // After the ring has widened past it and faded (0.58 to 0.66).
      const a2 = g.phone ? 0 : span(p, 0.62, 0.67) * (1 - span(p, 0.74, 0.77));
      const y = a2 > 0 ? under(el.one) : under(el.count);
      el.sep.style.transform = `translate3d(0,${y.toFixed(1)}px,0)`;
      el.sep.style.opacity = Math.max(a1, a2).toFixed(3);
    }

    // The containers.
    const settle = spread ? 1 : inOut(span(p, 0.05, 0.15));
    const conv0 = 0.24,
      convSpan = 0.13,
      travel = 0.08,
      shrink = 0.03;
    const par = pointer && !g.phone ? 1 - settle : 0;
    for (let k = 0; k < C.length; k++) {
      const i = g.order[k],
        c = C[i];
      const hp = c.hero,
        sl = c.slot;
      let x = lerp(hp.x + mx * 16 * hp.s * par, sl.x, settle);
      let y = lerp(hp.y + my * 10 * hp.s * par, sl.y, settle);
      let s = lerp(hp.s, 1, settle);
      const r = lerp(hp.r, 0, settle);
      let a = lerp(hp.a, 1, settle);
      const t0 = conv0 + (k * convSpan) / Math.max(n, 1);
      const tt = inOut(span(p, t0, t0 + travel));
      if (tt > 0) {
        const ctrl = { x: (sl.x + g.C.x) / 2, y: Math.min(sl.y, g.C.y) - H * 0.16 };
        const pt = bez(sl, ctrl, g.C, tt);
        x = pt.x;
        y = pt.y;
        s = lerp(1, 0.42, tt);
        s = lerp(s, 0.04, inOut(span(p, t0 + travel, t0 + travel + shrink)));
        a = 1 - span(p, t0 + travel + shrink * 0.6, t0 + travel + shrink);
      }
      T(c.el, x - c.o.x, y - c.o.y, s, r, a);
      c.el.style.visibility = a <= 0.001 ? "hidden" : "visible";
      const cap = caps[i];
      if (cap) {
        const cIn = spread ? 1 : easeOut(span(p, 0.1 + (i / n) * 0.06, 0.14 + (i / n) * 0.06));
        const cOut = span(p, t0 - 0.01, t0 + 0.03);
        cap.style.transform = `translate(${sl.x.toFixed(1)}px,${(sl.y + c.h / 2 + 14).toFixed(1)}px)`;
        cap.style.opacity = (cIn * (1 - cOut)).toFixed(3);
      }
    }

    // The ring closes around the point, frames the bag, then thins away.
    const rIn = span(p, 0.33, 0.38),
      rClose = inOut(span(p, 0.33, 0.47)),
      rOpen = inOut(span(p, 0.48, 0.58)),
      rOut = span(p, 0.58, 0.66);
    const R = rOpen > 0 ? lerp(28, g.bagH * 0.6, rOpen) : lerp(0.44 * Math.min(W, H), 28, rClose);
    T(el.ring, g.C.x, g.C.y, R / 100, 0, rIn * (1 - rOut) * 0.95);
    T(el.point, g.C.x, g.C.y, null, 0, span(p, 0.4, 0.44) * (1 - span(p, 0.49, 0.52)));

    // The bag grows out of the point, turns, and lands on the hook.
    const em = inOut(span(p, 0.48, 0.58));
    const ground = inOut(span(p, 0.86, 0.95));
    const call = inOut(span(p, 0.76, 0.86));
    if (B) {
      let bc = { x: lerp(g.C.x, g.bagC.x, em), y: lerp(g.C.y, g.bagC.y, em) };
      if (g.phone) bc.y -= H * 0.07 * call * (1 - ground);
      bc = { x: lerp(bc.x, g.roomC.x, ground), y: lerp(bc.y, g.roomC.y, ground) };
      const bs = lerp(0.04, 1, em) * lerp(1, g.roomS, ground);
      const tu = span(p, 0.68, 0.78);
      let ang = 0;
      if (tu > 0 && tu < 1)
        ang =
          tu < 0.45
            ? -18 * inOut(tu / 0.45)
            : tu < 0.8
              ? lerp(-18, 6, inOut((tu - 0.45) / 0.35))
              : lerp(6, 0, inOut((tu - 0.8) / 0.2));
      B.el.style.transform = `translate3d(${(bc.x - B.o.x).toFixed(2)}px,${(bc.y - B.o.y).toFixed(2)}px,0) rotateY(${ang.toFixed(2)}deg) scale(${bs.toFixed(4)})`;
      B.el.style.opacity = em > 0 ? Math.min(1, em * 4).toFixed(3) : "0";
      B.el.style.visibility = em > 0 ? "visible" : "hidden";
      B.band.style.transform = `translateX(${lerp(-110, 260, tu).toFixed(1)}%)`;
      B.band.style.opacity = tu > 0 && tu < 1 ? "1" : "0";
      B.el.style.setProperty("--rm", ground.toFixed(3));
      // The carrier rises once, to its own volume. Honest: the containers add none.
      const fl = inOut(span(p, 0.56, 0.68));
      const f = A.bag.fill;
      const bottom = f.rows[f.rows.length - 1][0];
      const row = bottom + (f.meniscus - bottom) * fl;
      const sp = rowSpan(row),
        m0 = f.rows[0];
      B.el.style.setProperty("--row", row.toFixed(2));
      B.el.style.setProperty("--msx", ((sp[2] - sp[1]) / (m0[2] - m0[1])).toFixed(4));
      B.el.style.setProperty("--mdx", ((sp[1] + sp[2]) / 2 - (m0[1] + m0[2]) / 2).toFixed(2));
      if (el.num) el.num.textContent = fmt(Math.round(fl * drip.volumeMl));
    }
    T(el.readout, g.read.x, g.read.y, null, 0, span(p, 0.55, 0.58) * (1 - span(p, 0.84, 0.88)));

    // "One drip." arrives faint behind the bag and firms.
    if (el.one) {
      const oIn = span(p, 0.49, 0.6),
        oOut = span(p, 0.84, 0.88);
      el.one.style.opacity = (lerp(0.15, 1, oIn) * (oIn > 0 ? 1 : 0) * (1 - oOut)).toFixed(3);
      el.one.style.transform = `translate3d(0,${(16 * (1 - oIn)).toFixed(1)}px,0)`;
    }

    // Callouts rise from the lower corners; they have been read by the time
    // the room comes up, and step out of its way.
    const cA = easeOut(span(p, 0.76, 0.82)),
      cB = easeOut(span(p, 0.79, 0.85)),
      up = inOut(span(p, 0.86, 0.92));
    const away = 1 - span(p, g.phone ? 0.845 : 0.86, g.phone ? 0.87 : 0.9);
    T(
      el.cardA,
      lerp(g.cards.a.x, g.cards.a2.x, up),
      lerp(g.cards.a.y + 60 * (1 - cA), g.cards.a2.y, up),
      null,
      0,
      cA * away
    );
    T(
      el.cardB,
      lerp(g.cards.b.x, g.cards.b2.x, up),
      lerp(g.cards.b.y + 60 * (1 - cB), g.cards.b2.y, up),
      null,
      0,
      cB * away
    );

    // The room rises behind; the evening; the quiz.
    if (el.room) {
      el.room.style.visibility = ground > 0 ? "visible" : "hidden";
      el.room.style.transform = `translate3d(0,${((1 - ground) * 100).toFixed(2)}%,0)`;
    }
    if (el.grounded) {
      const gIn = easeOut(span(p, 0.92, 0.97));
      // Opacity, not visibility: its links stay in the tab order, and focusing
      // one parks the act at the end, where they show.
      el.grounded.style.pointerEvents = gIn > 0.5 ? "auto" : "none";
      T(el.grounded, 0, g.groundedY + 28 * (1 - gIn), null, 0, gIn);
    }
  }

  return {
    layout,
    render,
    pointer(x: number, y: number) {
      mx = x;
      my = y;
    },
  };
}

// ---------------------------------------------------------------- mount
/** "hero": the home page, opening on its headline. "spread": a drip page, opening on the containers in a row. */
export type Opening = "hero" | "spread";

/** Mounts the act inside `act`; returns the cleanup. `still`: reduced motion. */
export function mountAssembly(
  act: HTMLElement,
  drip: AssemblyDrip,
  still: boolean,
  opening: Opening = "hero"
): () => void {
  const later: HTMLImageElement[] = [];
  const stages = [...act.querySelectorAll<HTMLElement>("[data-asm-stage]")];
  const scenes = stages.map((s) => scene(s, drip, later, opening));
  // Decoded ahead, off the main thread, so a picture's first frame on screen
  // never waits on its decode (the bag plates are 1.4k px, with alpha).
  const loadLater = () => {
    for (const i of later.splice(0)) {
      if (!i.dataset.src) continue;
      i.src = i.dataset.src;
      void i.decode?.().catch(() => {});
    }
  };
  const cleanups: Array<() => void> = [];

  if (still) {
    loadLater();
    const draw = () =>
      scenes.forEach((s, k) => {
        s.layout();
        s.render(STILL_P[k] ?? 0);
      });
    draw();
    addEventListener("resize", draw);
    cleanups.push(() => removeEventListener("resize", draw));
    return () => cleanups.forEach((c) => c());
  }

  const sc = scenes[0];
  if (!sc) return () => {};
  const state = { p: 0 };
  let tmx = 0,
    tmy = 0,
    mx = 0,
    my = 0,
    raf = 0;
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const frame = () => {
    raf = 0;
    mx += (tmx - mx) * 0.08;
    my += (tmy - my) * 0.08;
    sc.pointer(mx, my);
    sc.render(state.p, fine.matches);
    // Everything after the first screen loads once the act starts to move.
    if (state.p > 0.04) loadLater();
    if (Math.abs(tmx - mx) > 0.002 || Math.abs(tmy - my) > 0.002) queue();
  };
  const queue = () => {
    if (!raf) raf = requestAnimationFrame(frame);
  };

  gsap.registerPlugin(ScrollTrigger);
  sc.layout();
  // The act's own pinned mapping, (scrollY - top) / (height - vh), with a
  // 0.6 s catch-up: the scene glides to where the hand put it.
  const tween = gsap.fromTo(
    state,
    { p: 0 },
    {
      p: 1,
      ease: "none",
      onUpdate: queue,
      scrollTrigger: { trigger: act, start: "top top", end: "bottom bottom", scrub: 0.6, invalidateOnRefresh: true },
    }
  );
  queue();
  const onRefresh = () => {
    sc.layout();
    queue();
  };
  ScrollTrigger.addEventListener("refresh", onRefresh);
  // The stage is 100dvh: a phone's toolbar changes it without a window resize.
  const ro = new ResizeObserver(() => onRefresh());
  ro.observe(stages[0]);
  const onPointer = (e: PointerEvent) => {
    if (!fine.matches || state.p > 0.08) return;
    tmx = e.clientX / innerWidth - 0.5;
    tmy = e.clientY / innerHeight - 0.5;
    queue();
  };
  addEventListener("pointermove", onPointer, { passive: true });
  // The rest of the act's pictures load when the page is idle, if not before.
  const idle = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
    .requestIdleCallback;
  const onLoad = () => (idle ? idle(loadLater, { timeout: 2500 }) : setTimeout(loadLater, 1200));
  if (document.readyState === "complete") onLoad();
  else addEventListener("load", onLoad, { once: true });
  // Focus inside the act parks it where that control is visible.
  const onFocus = (e: FocusEvent) => {
    const t = e.target as HTMLElement;
    const at = t.closest("[data-asm-hero]") ? 0 : t.closest("[data-asm-grounded]") ? 0.985 : null;
    if (at == null) return;
    const rect = act.getBoundingClientRect();
    scrollTo({ top: scrollY + rect.top + at * (rect.height - innerHeight), behavior: "instant" });
  };
  act.addEventListener("focusin", onFocus);
  if (document.fonts) void document.fonts.ready.then(() => ScrollTrigger.refresh());

  return () => {
    tween.scrollTrigger?.kill();
    tween.kill();
    ScrollTrigger.removeEventListener("refresh", onRefresh);
    ro.disconnect();
    removeEventListener("pointermove", onPointer);
    removeEventListener("load", onLoad);
    act.removeEventListener("focusin", onFocus);
    if (raf) cancelAnimationFrame(raf);
    stages.forEach((s) => {
      s.querySelector("[data-asm-glass]")?.replaceChildren();
      s.querySelector("[data-asm-bag]")?.replaceChildren();
    });
  };
}
