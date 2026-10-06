// Small float-image toolkit for the asset pipeline: load, blur, masks, save.
// Everything is Float32 in 0..1 so divisions (flat-fielding) keep precision.
import sharp from "sharp";

export async function load(file) {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const r = new Float32Array(w * h),
    g = new Float32Array(w * h),
    b = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    r[i] = data[i * 3] / 255;
    g[i] = data[i * 3 + 1] / 255;
    b[i] = data[i * 3 + 2] / 255;
  }
  return { w, h, r, g, b, L: lum(r, g, b) };
}

export function lum(r, g, b) {
  const L = new Float32Array(r.length);
  for (let i = 0; i < r.length; i++) L[i] = 0.2126 * r[i] + 0.7152 * g[i] + 0.0722 * b[i];
  return L;
}

// Box blur, three passes, separable: a close Gaussian at O(n) per pass.
export function blur(src, w, h, radius) {
  const r = Math.max(1, Math.round(radius));
  let a = Float32Array.from(src);
  let t = new Float32Array(src.length);
  for (let pass = 0; pass < 3; pass++) {
    boxH(a, t, w, h, r);
    boxV(t, a, w, h, r);
  }
  return a;
}
function boxH(src, dst, w, h, r) {
  const n = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const o = y * w;
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[o + clamp(x, 0, w - 1)];
    for (let x = 0; x < w; x++) {
      dst[o + x] = acc / n;
      acc += src[o + clamp(x + r + 1, 0, w - 1)] - src[o + clamp(x - r, 0, w - 1)];
    }
  }
}
function boxV(src, dst, w, h, r) {
  const n = 2 * r + 1;
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += src[clamp(y, 0, h - 1) * w + x];
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = acc / n;
      acc += src[clamp(y + r + 1, 0, h - 1) * w + x] - src[clamp(y - r, 0, h - 1) * w + x];
    }
  }
}
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// Normalised convolution: the blur of the image where weight = 1, ignoring the
// rest. Fills the hole an object leaves with the ground around it.
export function fillBlur(src, weight, w, h, radius) {
  const num = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) num[i] = src[i] * weight[i];
  const bn = blur(num, w, h, radius),
    bw = blur(weight, w, h, radius);
  const out = new Float32Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = bw[i] > 1e-4 ? bn[i] / bw[i] : 0;
  return out;
}

export function dilate(mask, w, h, r) {
  const b = blur(mask, w, h, Math.max(1, r / 1.7));
  return Float32Array.from(b, (v) => (v > 0.02 ? 1 : 0));
}
export function erode(mask, w, h, r) {
  const b = blur(mask, w, h, Math.max(1, r / 1.7));
  return Float32Array.from(b, (v) => (v > 0.98 ? 1 : 0));
}

// Flood fill from the image border through pixels where pass[i] is true.
export function floodFromBorder(pass, w, h) {
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (i) => {
    if (!seen[i] && pass[i]) {
      seen[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w,
      y = (i / w) | 0;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }
  return seen;
}

// The connected component of `on` pixels containing (sx, sy).
export function component(on, w, h, sx, sy) {
  const out = new Uint8Array(w * h);
  const start = sy * w + sx;
  if (!on[start]) throw new Error(`seed ${sx},${sy} is not inside the mask`);
  const stack = [start];
  out[start] = 1;
  while (stack.length) {
    const i = stack.pop();
    const x = i % w,
      y = (i / w) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
      if (j >= 0 && on[j] && !out[j]) {
        out[j] = 1;
        stack.push(j);
      }
    }
  }
  return out;
}

export function bbox(mask, w, h) {
  let x0 = w,
    y0 = h,
    x1 = -1,
    y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (mask[y * w + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return { x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

// Save helpers. `rgba` is four Float32 planes in 0..1, straight alpha.
export async function saveRGBA(file, w, h, r, g, b, a, { crop, resize, webp = false } = {}) {
  const buf = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    buf[i * 4] = to8(r[i]);
    buf[i * 4 + 1] = to8(g[i]);
    buf[i * 4 + 2] = to8(b[i]);
    buf[i * 4 + 3] = to8(a[i]);
  }
  let img = sharp(buf, { raw: { width: w, height: h, channels: 4 } });
  if (crop)
    img = sharp(await img.extract({ left: crop.x, top: crop.y, width: crop.w, height: crop.h }).png().toBuffer());
  if (resize) img = img.resize(resize);
  if (webp) await img.webp({ quality: 90, alphaQuality: 92, smartSubsample: true }).toFile(file);
  else await img.png({ compressionLevel: 8 }).toFile(file);
}
export async function saveGray(file, w, h, plane, opts = {}) {
  return saveRGBA(file, w, h, plane, plane, plane, new Float32Array(w * h).fill(1), opts);
}
export const to8 = (v) => (v <= 0 ? 0 : v >= 1 ? 255 : Math.round(v * 255));
