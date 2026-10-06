// Frames of the assembly act on the real route (localhost:3000), evenly spaced
// through its pinned travel, tiled into one sheet. Skips the intro loader the
// way the site does (nd_intro_at), waits out the 0.6 s scrub per frame.
//   node tools/strip-app.mjs [width] [height] [count] [outDir] [--reduced]
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { chromium } from "playwright-core";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const reduced = process.argv.includes("--reduced");
const [W = "1440", H = "900", N = "10", out = "lab/app-strip"] = args;
const w = +W,
  h = +H,
  n = +N;
fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--disable-features=PointerLock"],
});
try {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("nd_intro_at", String(Date.now()));
    } catch {}
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
  page.on("response", (r) => r.status() >= 400 && errors.push(`${r.status()} ${r.url()}`));
  await page.goto((process.env.BASE ?? "http://localhost:3000") + (process.env.PAGE ?? "/"), {
    waitUntil: "networkidle",
    timeout: 120000,
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.waitForTimeout(1500);
  const files = [];
  for (let k = 0; k < n; k++) {
    const p = n === 1 ? 0 : k / (n - 1);
    await page.evaluate((p) => {
      const act = document.querySelector("[data-asm-stage]").closest("section");
      const r = act.getBoundingClientRect();
      window.scrollTo({
        top: Math.round(scrollY + r.top + p * Math.max(r.height - innerHeight, 0)),
        behavior: "instant",
      });
    }, p);
    await page.waitForTimeout(k === 0 ? 400 : 1200);
    const f = path.join(out, `f${String(k).padStart(2, "0")}.png`);
    await page.screenshot({ path: f });
    files.push(f);
  }
  const cols = 5,
    tw = Math.round(w / (w > 1000 ? 4 : 2.2)),
    th = Math.round((tw * h) / w),
    gap = 8,
    lab = 22;
  const rows = Math.ceil(n / cols);
  const tiles = await Promise.all(files.map((f) => sharp(f).resize(tw, th).png().toBuffer()));
  const labels = files.map((_, k) =>
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="${lab}"><text x="2" y="16" font-family="Arial" font-size="14" fill="#333">p ${(n === 1 ? 0 : k / (n - 1)).toFixed(2)}</text></svg>`
    )
  );
  await sharp({
    create: {
      width: cols * (tw + gap) + gap,
      height: rows * (th + lab + gap) + gap,
      channels: 3,
      background: "#e6e8ea",
    },
  })
    .composite(
      tiles.flatMap((t, k) => {
        const x = gap + (k % cols) * (tw + gap),
          y = gap + Math.floor(k / cols) * (th + lab + gap);
        return [
          { input: labels[k], left: x, top: y },
          { input: t, left: x, top: y + lab },
        ];
      })
    )
    .png()
    .toFile(path.join(out, "strip.png"));
  console.log(path.join(out, "strip.png"));
  console.log("errors:", errors.length ? errors : "none");
} finally {
  await browser.close();
}
