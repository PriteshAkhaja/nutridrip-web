// The client's two glass vials with their print lifted off, for the home
// page's build: every vial there is labelled in HTML with our own dose
// (2026-11-02, the user's choice: the client's photos printed doses our drips
// do not use, and "Immunity, Antioxidant, Rejuvenate").
//
//   node scrollcraft/builds/home-v3/tools/blank-vial.mjs   (from nutridrip-new/)
//
// For each photo, column by column: find the label's paper edges (its top
// edge curves with the glass), take the clean paper just inside each edge,
// and repaint the label between them as a vertical blend of the two, so the
// shading round the curve survives and the print, the coloured band and all,
// goes. The cap stays: Vitamin C keeps its yellow one; the page recolours the
// teal one for any other vial.
import sharp from "sharp";

const SRC = "_reference/NutriDrip IV Nutrient Therapy/assets/img";
const OUT = "public/site/v3";
const VIALS = [
  { from: "vial-vitc.webp", to: "vial-vitc-blank.webp", rows: [290, 840] },
  { from: "vial-calcium.webp", to: "vial-calcium-blank.webp", rows: [300, 835] },
];

for (const v of VIALS) {
  const { data, info } = await sharp(`${SRC}/${v.from}`).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width,
    C = info.channels;
  const at = (x, y) => (y * W + x) * C;
  const L = (i) => 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
  const paper = (x, y) => data[at(x, y) + 3] > 200 && L(at(x, y)) > 212; // label paper is 215-250; the glass round it is darker
  const out = Buffer.from(data);
  const [r0, r1] = v.rows;
  // Pass 1, each column's label edges: the first and last rows that start a
  // run of eight paper rows. A column whose print reaches an edge, or the
  // glass beside it, can misread; pass 2 smooths over those.
  const edge = (x) => {
    let t = -1,
      b = -1;
    for (let y = r0; y < r1 - 8 && t < 0; y++) {
      let ok = true;
      for (let k = 0; k < 8 && ok; k++) ok = paper(x, y + k);
      if (ok) t = y;
    }
    for (let y = r1; y > r0 + 8 && b < 0; y--) {
      let ok = true;
      for (let k = 0; k < 8 && ok; k++) ok = paper(x, y - k);
      if (ok) b = y;
    }
    return t >= 0 && b >= 0 && b - t > 300 ? [t, b] : null;
  };
  const raw = Array.from({ length: W }, (_, x) => edge(x));
  // Pass 2: the edges as a rolling median over 41 columns, filled in where a
  // column found none, so one bad column cannot show as a seam.
  const median = (a) => a.slice().sort((p, q) => p - q)[a.length >> 1];
  const smooth = (k) =>
    raw.map((_, x) => {
      const w = [];
      for (let d = -20; d <= 20; d++) if (raw[x + d]) w.push(raw[x + d][k]);
      return w.length ? median(w) : null;
    });
  const T = smooth(0),
    B = smooth(1);
  // The clean paper just inside each edge, per column, then smoothed across 9
  // columns the same way: the curve's shading survives, a stray mark does not.
  const sample = (x, ya, yb) => {
    const acc = [0, 0, 0];
    for (let y = ya; y <= yb; y++) for (let c = 0; c < 3; c++) acc[c] += data[at(x, y) + c];
    return acc.map((v) => v / (yb - ya + 1));
  };
  const topC = T.map((t, x) => (t == null ? null : sample(x, t + 3, t + 10)));
  const botC = B.map((b, x) => (b == null ? null : sample(x, b - 10, b - 3)));
  const near = (arr, x) => {
    const w = [];
    for (let d = -4; d <= 4; d++) if (arr[x + d]) w.push(arr[x + d]);
    return [0, 1, 2].map((c) => median(w.map((v) => v[c])));
  };
  let done = 0;
  for (let x = 0; x < W; x++) {
    const t = T[x],
      b = B[x];
    if (t == null || b == null) continue;
    const top = near(topC, x),
      bot = near(botC, x);
    for (let y = t + 2; y <= b - 2; y++) {
      const i = at(x, y);
      if (data[i + 3] < 200) continue;
      const f = (y - t) / (b - t);
      for (let c = 0; c < 3; c++) out[i + c] = Math.round(top[c] * (1 - f) + bot[c] * f);
    }
    done++;
  }
  const tops = T.filter((v) => v != null),
    bottoms = B.filter((v) => v != null);
  await sharp(out, { raw: { width: W, height: info.height, channels: C } })
    .webp({ quality: 90, alphaQuality: 95 })
    .toFile(`${OUT}/${v.to}`);
  console.log(
    `${v.to}: ${W}x${info.height}, ${done} columns repainted, label rows ~${median(tops)}-${median(bottoms)} (top edge ${Math.min(...tops)}-${Math.max(...tops)})`
  );
}

// The teal cap's own shape, as an alpha mask (vial-cap-mask.png): the page
// recolours the cap through it, so the colour reaches the cap's lip and never
// the metal crimp below it.
{
  const { data, info } = await sharp(`${SRC}/vial-calcium.webp`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width,
    H = info.height;
  const mask = Buffer.alloc(W * H);
  let rows = [H, 0];
  for (let y = 0; y < 200; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
      if (a > 120 && g - r > 35 && b - r > 25) {
        mask[y * W + x] = 255;
        rows = [Math.min(rows[0], y), Math.max(rows[1], y)];
      }
    }
  // White, with the cap as alpha: an alpha mask, which every browser reads.
  // Its edge softened by a 3 x 3 average, so the colour does not stop on a hard pixel line.
  const soft = Buffer.alloc(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let sum = 0,
        n = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const yy = y + dy,
            xx = x + dx;
          if (yy < 0 || yy >= H || xx < 0 || xx >= W) continue;
          sum += mask[yy * W + xx];
          n++;
        }
      soft[y * W + x] = Math.round(sum / n);
    }
  const rgba = Buffer.alloc(W * H * 4, 255);
  for (let p = 0; p < W * H; p++) rgba[p * 4 + 3] = soft[p];
  await sharp(rgba, { raw: { width: W, height: H, channels: 4 } })
    .png()
    .toFile(`${OUT}/vial-cap-mask.png`);
  console.log(`vial-cap-mask.png: cap rows ${rows[0]}-${rows[1]}`);
}
