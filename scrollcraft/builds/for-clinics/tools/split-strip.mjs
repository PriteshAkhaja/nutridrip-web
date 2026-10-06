// The economics card at evenly spaced positions of the split's scroll window
// (card top at 78% of the screen to card bottom at 52%), tiled.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { chromium } from "playwright-core";
const [W = "1440", H = "900", N = "6", out = "lab/split"] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const reduced = process.argv.includes("--reduced");
const BASE = process.env.BASE ?? "http://localhost:4622",
  PAGE = process.env.PAGE ?? "/index.html",
  SEL = process.env.SEL ?? "[data-split]";
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const c = await b.newContext({
    viewport: { width: +W, height: +H },
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  await c.addInitScript(() => {
    try {
      localStorage.setItem("nd_intro_at", String(Date.now()));
    } catch {}
  });
  const p = await c.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  await p.goto(BASE + PAGE, { waitUntil: "networkidle", timeout: 120000 });
  await p.waitForTimeout(800);
  const files = [];
  for (let k = 0; k < +N; k++) {
    const t = k / (+N - 1);
    await p.evaluate(
      ([sel, t]) => {
        const el = document.querySelector(sel);
        const r = el.getBoundingClientRect();
        const a = scrollY + r.top - innerHeight * 0.78,
          z = scrollY + r.bottom - innerHeight * 0.52;
        scrollTo({ top: Math.round(a + t * (z - a)), behavior: "instant" });
      },
      [SEL, t]
    );
    await p.waitForTimeout(900);
    const box = await p.evaluate((sel) => {
      const r = document.querySelector(sel).getBoundingClientRect();
      return {
        x: Math.max(0, r.left - 16),
        y: Math.max(0, r.top - 16),
        width: Math.min(innerWidth, r.width + 32),
        height: Math.min(innerHeight - Math.max(0, r.top - 16), r.height + 32),
      };
    }, SEL);
    const f = path.join(out, `f${k}.png`);
    await p.screenshot({ path: f, clip: box });
    files.push(f);
  }
  const tiles = await Promise.all(
    files.map((f) => sharp(f).resize({ width: 520 }).png().toBuffer({ resolveWithObject: true }))
  );
  const hmax = Math.max(...tiles.map((t) => t.info.height));
  await sharp({ create: { width: tiles.length * 530, height: hmax + 10, channels: 3, background: "#e6e8ea" } })
    .composite(tiles.map((t, i) => ({ input: t.data, left: i * 530 + 5, top: 5 })))
    .png()
    .toFile(path.join(out, "strip.png"));
  console.log(path.join(out, "strip.png"), "errors:", errors.length ? errors : "none");
} finally {
  await b.close();
}
