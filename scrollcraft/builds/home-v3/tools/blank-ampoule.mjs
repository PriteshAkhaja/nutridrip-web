// A blank NutriDrip ampoule, for ingredients the client has no product photo
// of (pyridoxine, cyanocobalamin, zinc, taurine, ...).
//
//   node scrollcraft/builds/home-v3/tools/blank-ampoule.mjs   (from nutridrip-new/)
//
// Starts from the client's magnesium sulfate ampoule (vial-magnesium.webp,
// 196 x 900) and keeps everything that makes it real: the amber glass, the
// neck, the shading round the label. Two things go:
// - the print and the blue band on the label (y 446 to 816), rebuilt as the
//   label's own white, column by column, from the clean rows at its top and
//   bottom edge, so the curve of the shading survives;
// - the blue ring on the neck, which marks magnesium, replaced by the glass
//   just above and below it.
// page.js then sets each ingredient's label in HTML, in the client's design.
import sharp from "sharp";
import path from "node:path";

const A = "scrollcraft/builds/home-v3/assets";
const SRC = "_reference/NutriDrip IV Nutrient Therapy/assets/img/vial-magnesium.webp";
const { data, info } = await sharp(SRC).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width,
  H = info.height,
  C = info.channels;
const at = (x, y) => (y * W + x) * C;
const L = (i) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
const out = Buffer.from(data);

// 1. The label: per column, the mean of the clean white rows at its edges.
const LABEL = { y0: 446, y1: 816 },
  CLEAN = [
    [448, 462],
    [800, 814],
  ];
for (let x = 0; x < W; x++) {
  const acc = [0, 0, 0];
  let n = 0;
  for (const [a, b] of CLEAN)
    for (let y = a; y <= b; y++) {
      const i = at(x, y);
      if (data[i + 3] < 200 || L(i) < 150) continue; // not label: background or glass edge
      for (let c = 0; c < 3; c++) acc[c] += data[i + c];
      n++;
    }
  if (!n) continue;
  for (let y = LABEL.y0; y <= LABEL.y1; y++) {
    const i = at(x, y);
    if (data[i + 3] < 200) continue;
    for (let c = 0; c < 3; c++) out[i + c] = Math.round(acc[c] / n);
  }
}

// 2. The neck ring: rows where blue clearly outweighs red, between y 250 and
//    360, are blended from the glass rows just outside the ring.
const ring = [];
for (let y = 250; y < 360; y++) {
  let blue = 0,
    seen = 0;
  for (let x = 0; x < W; x++) {
    const i = at(x, y);
    if (data[i + 3] < 200) continue;
    seen++;
    if (data[i + 2] > data[i] + 18) blue++;
  }
  if (seen && blue / seen > 0.25) ring.push(y);
}
if (ring.length) {
  const top = ring[0] - 2,
    bottom = ring[ring.length - 1] + 2;
  for (let y = top + 1; y < bottom; y++) {
    const t = (y - top) / (bottom - top);
    for (let x = 0; x < W; x++) {
      const i = at(x, y),
        a = at(x, top),
        b = at(x, bottom);
      if (data[i + 3] < 30) continue;
      for (let c = 0; c < 3; c++) out[i + c] = Math.round(data[a + c] * (1 - t) + data[b + c] * t);
    }
  }
}

await sharp(out, { raw: { width: W, height: H, channels: C } })
  .webp({ quality: 90, alphaQuality: 95 })
  .toFile(path.join(A, "ampoule-blank.webp"));
console.log(
  `ampoule-blank.webp: label wiped (y ${LABEL.y0}-${LABEL.y1}), neck ring rows ${ring.length ? `${ring[0]}-${ring[ring.length - 1]}` : "none found"}`
);
