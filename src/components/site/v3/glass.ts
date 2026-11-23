/**
 * The labelled glass each ingredient arrives in, shared by the landing's build
 * (home/motion.ts) and the drip page's companion bag (drip/): the markup, the
 * band colours, and the label's fit to its glass. Styles in styles/glass.css.
 */

/** An ingredient as its label prints it: the dose already written ("1,000 mg"), and the same amount one unit up. */
export type GlassItem = { name: string; dose: string; alt: string | null; molecule: string | null; form: string };
export type GlassColour = { band: string; cap: string | null };

const A = "/site/v3";
const esc = (s: unknown) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c
  );

// The glass each ingredient arrives in, by the form its stock lots record
// (AGENTS.md): the client's amber ampoule or clear vial with their print
// lifted off (scrollcraft/builds/home-v3/tools/blank-ampoule.mjs,
// blank-vial.mjs), and our own label printed on it: the client's photos
// carried doses our drips do not use (2026-11-02). Each label is laid out at
// 196 px wide (--k scales it to the glass); lt and lh place it on the photo's
// label paper.
type Glass = { src: string; w: number; h: number; lt: string; lh: number; vial: boolean };
const AMPOULE: Glass = { src: `${A}/ampoule-blank.webp`, w: 196, h: 900, lt: "49.6%", lh: 370, vial: false };
const VIAL: Glass = { src: `${A}/vial-calcium-blank.webp`, w: 338, h: 900, lt: "35.8%", lh: 288, vial: true };
const VIAL_C: Glass = { src: `${A}/vial-vitc-blank.webp`, w: 349, h: 900, lt: "36.7%", lh: 279, vial: true };
const isVitaminC = (it: GlassItem) => /ascorbic|vitamin c/i.test(`${it.name} ${it.molecule ?? ""}`);
const glassOf = (it: GlassItem) => (it.form === "Ampoule" ? AMPOULE : isVitaminC(it) ? VIAL_C : VIAL);

// Band colours are label colours, never the clinical hues. The products the
// client photographed keep their colour (Vitamin C's lemon, magnesium's blue,
// B-complex's lavender, calcium's teal, B12's pink); every other ingredient
// takes one from the palette. A vial's cap takes the deeper shade beside its
// band; the teal and the lemon are the photographs' own caps.
const BANDS = ["#CDBFEF", "#BBD4EE", "#F0C4D6", "#B6E2DD", "#DCC8EF", "#C5CDF2"];
const CAPS = ["#8C6FD8", "#4F8FD6", "#D9578E", null, "#A779D6", "#6E7FE0"];
const LEMON = "#F5DC6A";
const OWN: Array<[RegExp, number]> = [
  [/b[- ]?complex/i, 0],
  [/magnesium/i, 1],
  [/cobalamin|vitamin b12/i, 2],
  [/calcium/i, 3],
];
function band(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h % BANDS.length;
}
const ownBand = (it: GlassItem) => OWN.find(([re]) => re.test(`${it.name} ${it.molecule ?? ""}`))?.[1] ?? null;

/**
 * One colour per glass in a drip: each ingredient keeps its own colour unless
 * another glass in this drip already shows it; then it takes the next free one.
 */
export function bandColours(items: GlassItem[]): GlassColour[] {
  const used = new Set<number>();
  items.forEach((it) => {
    const o = ownBand(it);
    if (o != null) used.add(o);
  });
  return items.map((it) => {
    if (isVitaminC(it)) return { band: LEMON, cap: null };
    let c = ownBand(it);
    if (c == null) {
      c = band(it.name);
      for (let j = 0; j < BANDS.length && used.has(c); j++) c = (c + 1) % BANDS.length;
      used.add(c);
    }
    return { band: BANDS[c], cap: CAPS[c] };
  });
}

// The band reads like the client's ("MAGNESIUM / SULFATE 50%",
// "METHYLCOBALAMIN / (B12)"): the name in up to two balanced lines, then the
// vitamin it is, when the master records one the name does not say.
function bandLines(it: GlassItem) {
  const words = it.name.toUpperCase().split(/\s+/);
  let lines = words;
  if (words.length > 1) {
    let cut = 1;
    let best = 1e9;
    for (let i = 1; i < words.length; i++) {
      const d = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
      if (d < best) {
        best = d;
        cut = i;
      }
    }
    lines = [words.slice(0, cut).join(" "), words.slice(cut).join(" ")];
  }
  const vit = it.molecule ? /^vitamin\s+(.+)$/i.exec(it.molecule) : null;
  if (vit && it.molecule && !it.name.toLowerCase().includes(it.molecule.toLowerCase()))
    lines = lines.concat(`(${vit[1].toUpperCase()})`);
  return lines;
}

/**
 * Each character's advance in a band (Outfit 800 with its letter-spacing) at
 * 100 px, measured in the browser (scrollcraft/builds/home-v2/tools/band-widths.mjs).
 * Summed they come within about 1% of the real line (kerning), so the server
 * can print a band at the size fitBands then sets, and nothing jumps on load.
 */
const BAND_W: Record<string, number> = {
  " ": 17.3,
  A: 69.4,
  B: 63.8,
  C: 65.3,
  D: 74.9,
  E: 61.5,
  F: 59,
  G: 78.9,
  H: 72.7,
  I: 29.3,
  J: 50,
  K: 69.2,
  L: 55.5,
  M: 85.4,
  N: 73.6,
  O: 81,
  P: 62.2,
  Q: 80.7,
  R: 63.8,
  S: 56.7,
  T: 62,
  U: 69.6,
  V: 67.8,
  W: 97.3,
  X: 66.8,
  Y: 64.2,
  Z: 57.8,
  "0": 65.9,
  "1": 37.8,
  "2": 56.4,
  "3": 55.7,
  "4": 59.7,
  "5": 55.6,
  "6": 56.7,
  "7": 50.9,
  "8": 55.7,
  "9": 56.7,
  "(": 30.3,
  ")": 30.3,
  "-": 45.1,
  ".": 29.2,
  ",": 27.5,
  "/": 36.4,
  "+": 55.9,
  "%": 68.6,
  "&": 68.9,
  "'": 24.2,
  "’": 25.4,
  ":": 28.8,
};
/** The largest size a band's lines start from: one word may set larger, in the same height. */
const bandCap = (n: number) => (n === 1 ? 34 : n === 2 ? 30 : 24);
/** A band's size, as fitBands works it out, from the character widths. */
export function bandSize(lines: string[]) {
  const cap = bandCap(lines.length);
  const w = Math.max(0, ...lines.map((l) => [...l].reduce((s, c) => s + (BAND_W[c] ?? 62), 0))) * (cap / 100);
  return w ? Math.min(cap, (cap * 172) / w) : cap;
}

/** The glass and its printed label, as HTML: the landing writes it on the client as the drip changes, the drip page on the server. */
export function glassHTML(it: GlassItem, colour: GlassColour) {
  const g = glassOf(it);
  const lines = bandLines(it);
  return (
    // --gar (width over height) lets a page whose glass height is known in CSS
    // scale the label from the first paint (drip-build.css), before scaleLabels.
    `<div class="vial__glass" style="aspect-ratio:${g.w}/${g.h};--gar:${(g.w / g.h).toFixed(4)};--band:${colour.band}"><img class="vial__photo" src="${g.src}" alt="">` +
    // An ampoule's coloured neck ring, or a vial's cap in the band's shade.
    (g.vial ? (colour.cap ? `<i class="vcap" style="--cap:${colour.cap}"></i>` : "") : `<i class="vring"></i>`) +
    // <p>, not <span>: the client's ".vial span" rule styles the caption under
    // each vial and would catch every span in the label.
    `<div class="vlabel${g.vial ? " vlabel--vial" : ""}" style="--lt:${g.lt};--lh:${g.lh}px">` +
    `<p class="vlabel__word">NutriDrip<sup>™</sup></p><p class="vlabel__sub">IV NUTRIENT THERAPY</p>` +
    `<p class="vlabel__band" style="--nfs:${bandSize(lines).toFixed(2)}px">${lines
      .map((l) => `<b>${esc(l)}</b>`)
      .join("")}</p>` +
    `<div class="vlabel__low"><p class="vlabel__dose">${esc(it.dose)}${it.alt ? `<small>${esc(it.alt)}</small>` : ""}</p>` +
    `<i class="vlabel__rule"></i>` +
    `<svg class="vlabel__inf" viewBox="0 0 100 50" aria-hidden="true"><path d="M50 25C40 11 33 7 25 7 15 7 7 15 7 25s8 18 18 18c8 0 15-4 25-18s17-18 25-18c10 0 18 8 18 18s-8 18-18 18c-8 0-15-4-25-18Z" fill="none" stroke="currentColor" stroke-width="5"/></svg>` +
    `<p class="vlabel__foot">For IV Use Only</p></div></div></div>`
  );
}

/**
 * Each band's lines share one size, the largest that keeps the widest line
 * inside the label's printable width (172 of its 196 px), as the client's
 * bands fill theirs; a one-word band may set larger, in the same two-line
 * height. Measure after the fonts load.
 */
export function fitBands(scope: ParentNode) {
  scope.querySelectorAll<HTMLElement>(".vlabel__band").forEach((b) => {
    const ls = [...b.querySelectorAll<HTMLElement>("b")];
    const cap = bandCap(ls.length);
    b.style.setProperty("--nfs", `${cap}px`);
    const w = ls.reduce((m, l) => Math.max(m, l.offsetWidth), 0);
    if (w) b.style.setProperty("--nfs", `${Math.min(cap, (cap * 172) / w).toFixed(2)}px`);
  });
}

/**
 * Each label is laid out at 196 px and scaled to its glass, by the glass's
 * exact width: offsetWidth rounds to whole pixels, an error of up to 1.7% on
 * a glass 30 px wide, enough to push a band past its label's edge. The
 * computed width is exact, and ignores any transforms in flight.
 */
export function scaleLabels(scope: ParentNode) {
  scope.querySelectorAll<HTMLElement>(".vlabel").forEach((l) => {
    const w = l.parentElement ? parseFloat(getComputedStyle(l.parentElement).width) : 196;
    l.style.setProperty("--k", ((w || 196) / 196).toFixed(5));
  });
}
