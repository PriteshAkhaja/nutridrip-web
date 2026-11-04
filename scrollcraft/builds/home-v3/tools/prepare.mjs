// Prepares the v3 assets that are derived rather than copied.
//
//   node scrollcraft/builds/home-v3/tools/prepare.mjs   (run from nutridrip-new/)
//
// - chamber.webp: frame 72 of the client's chamber.mp4, the first frame with no
//   drop at the tip, so the drop drawn in code is the only one on screen.
// - bag-blur-*.webp: the client's empty bag, filled with a palette tint inside
//   its own mask and blurred here, once. The client's hero blurred these planes
//   with CSS filter on moving layers, which costs every frame; a baked blur
//   costs nothing (AGENTS.md: no blur on moving or sticky layers).
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const A = "scrollcraft/builds/home-v3/assets";

// ------------------------------------------------------------ the chamber
const raw = path.join(A, "chamber-f72.png");
execFileSync("ffmpeg", [
  "-v",
  "error",
  "-y",
  "-i",
  path.join(A, "chamber.mp4"),
  "-vf",
  "select=eq(n\\,72)",
  "-fps_mode",
  "passthrough",
  "-frames:v",
  "1",
  raw,
]);
await sharp(raw).webp({ quality: 84 }).toFile(path.join(A, "chamber.webp"));
fs.rmSync(raw);
console.log("chamber.webp", (await sharp(path.join(A, "chamber.webp")).metadata()).width);

// ------------------------------------------------------------ tinted bags
// The fill band matches .nd-bag__fill::before in site.css: from 13.5% above the
// bottom, 79.5% tall, a gradient from the tint mixed with white to the tint.
async function tintedBag(hex, blur, out) {
  const W = 577,
    H = 1200;
  const top = Math.round(H * (1 - 0.135 - 0.795)),
    bottom = Math.round(H * (1 - 0.135));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${hex}" stop-opacity=".55"/><stop offset="1" stop-color="${hex}" stop-opacity=".84"/>
    </linearGradient></defs>
    <rect x="0" y="${top}" width="${W}" height="${bottom - top}" fill="url(#g)"/></svg>`;
  // bag-mask.png carries the bag's silhouette in its alpha: dest-in keeps the
  // fill only inside it, as the CSS mask does on the page.
  const fill = await sharp(Buffer.from(svg))
    .composite([{ input: path.join(A, "bag-mask.png"), blend: "dest-in" }])
    .png()
    .toBuffer();
  const composed = await sharp(fill)
    .composite([{ input: path.join(A, "bag-empty.webp") }])
    .png()
    .toBuffer();
  await sharp(composed)
    .resize({ height: 600 })
    .blur(blur)
    .webp({ quality: 80, alphaQuality: 85 })
    .toFile(path.join(A, out));
  console.log(out, hex, `blur ${blur}`);
}
await tintedBag("#DB5B93", 4, "bag-blur-a.webp"); // rose, far left
await tintedBag("#16A6B6", 5, "bag-blur-b.webp"); // aqua, far right
await tintedBag("#7B5BD6", 11, "bag-blur-front.webp"); // violet, nearest

// ------------------------------------------------------------ hero planes
// The client's hero runs CSS filters on three moving planes (home.css):
//   back--1  blur(6px)  hue-rotate(-28deg)  saturate(1.05)   at clamp(90px, 9vw, 150px)
//   back--2  blur(7px)  hue-rotate(115deg)  saturate(.8)     at clamp(80px, 7.5vw, 125px)
//   front    blur(16px)                                      at clamp(200px, 21vw, 360px)
// Baked here instead, at the 1440 px width, with 50 px of transparent margin
// so the blur fades out rather than clipping at the image edge. home.css
// widens each plane by the same margin (x 379/279) and pulls it back.
async function heroPlane(out, { sigma, hue = 0, saturation = 1 }) {
  const P = 50;
  await sharp(path.join(A, "bag-hero-s.webp"))
    .ensureAlpha()
    .extend({ top: P, bottom: P, left: P, right: P, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .modulate({ hue, saturation })
    .blur(sigma)
    .webp({ quality: 82, alphaQuality: 90 })
    .toFile(path.join(A, out));
  console.log(out, `σ${sigma} hue ${hue} sat ${saturation}`);
}
await heroPlane("hero-back-1.webp", { sigma: 12.9, hue: -28, saturation: 1.05 }); // 6px at 129.6/279
await heroPlane("hero-back-2.webp", { sigma: 18.1, hue: 115, saturation: 0.8 }); // 7px at 108/279
await heroPlane("hero-front.webp", { sigma: 14.8 }); // 16px at 302.4/279
