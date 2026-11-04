// The client's hero bag photograph, with the print lifted off its label card.
//
//   node scrollcraft/builds/home-v3/tools/clean-hero-bag.mjs   (from nutridrip-new/)
//
// bag-hero.webp (611 x 1400) has "NutriDrip™", "IV NUTRIENT THERAPY" and
// "∞ | 500 mL" printed into the image. AGENTS.md: text over imagery is HTML,
// never baked in. So the photograph keeps everything that makes it real (the
// card, its shading, the liquid, the meniscus) and only the dark print inside
// the card is replaced by the card's own white, rebuilt from the pixels around
// it. page markup then sets the same words in HTML at the same places.
import sharp from "sharp";
import path from "node:path";

const A = "scrollcraft/builds/home-v3/assets";
const CARD = { x0: 122, y0: 382, x1: 494, y1: 1118 }; // inside the rounded corners
const { data, info } = await sharp(path.join(A, "bag-hero.webp"))
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const W = info.width,
  C = info.channels;
const lum = (i) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];

// 1. Print = anything clearly darker than the card around it, grown by 3 px so
//    the anti-aliased edges go too.
const cw = CARD.x1 - CARD.x0,
  ch = CARD.y1 - CARD.y0;
const ink = new Uint8Array(cw * ch);
for (let y = 0; y < ch; y++)
  for (let x = 0; x < cw; x++) {
    const i = ((CARD.y0 + y) * W + CARD.x0 + x) * C;
    if (lum(i) < 228) ink[y * cw + x] = 1;
  }
const grown = new Uint8Array(cw * ch);
const R = 3;
for (let y = 0; y < ch; y++)
  for (let x = 0; x < cw; x++) {
    if (!ink[y * cw + x]) continue;
    for (let dy = -R; dy <= R; dy++)
      for (let dx = -R; dx <= R; dx++) {
        const yy = y + dy,
          xx = x + dx;
        if (yy >= 0 && yy < ch && xx >= 0 && xx < cw) grown[yy * cw + xx] = 1;
      }
  }

// 2. The card's own shading, from the clean pixels only: for each masked pixel,
//    the mean of the nearest clean pixels in its row to the left and right,
//    blended with the column above and below. Cards shade gently, so this is
//    smooth enough to be invisible.
function nearest(x, y, dx, dy) {
  for (let k = 1; k < 120; k++) {
    const xx = x + dx * k,
      yy = y + dy * k;
    if (xx < 0 || yy < 0 || xx >= cw || yy >= ch) return null;
    if (!grown[yy * cw + xx]) return [xx, yy, k];
  }
  return null;
}
let filled = 0;
const out = Buffer.from(data);
for (let y = 0; y < ch; y++)
  for (let x = 0; x < cw; x++) {
    if (!grown[y * cw + x]) continue;
    const picks = [nearest(x, y, -1, 0), nearest(x, y, 1, 0), nearest(x, y, 0, -1), nearest(x, y, 0, 1)].filter(
      Boolean
    );
    const acc = [0, 0, 0];
    let wsum = 0;
    for (const [xx, yy, k] of picks) {
      const w = 1 / k;
      const i = ((CARD.y0 + yy) * W + CARD.x0 + xx) * C;
      for (let c = 0; c < 3; c++) acc[c] += data[i + c] * w;
      wsum += w;
    }
    const o = ((CARD.y0 + y) * W + CARD.x0 + x) * C;
    for (let c = 0; c < 3; c++) out[o + c] = Math.round(acc[c] / wsum);
    filled++;
  }

await sharp(out, { raw: { width: W, height: info.height, channels: C } })
  .webp({ quality: 90, alphaQuality: 95 })
  .toFile(path.join(A, "bag-hero-clean.webp"));
console.log(`bag-hero-clean.webp: ${filled} print pixels replaced inside the card`);
