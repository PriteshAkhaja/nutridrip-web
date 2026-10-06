// Frames of the assembly act at evenly spaced positions of its pinned travel,
// tiled into one sheet. The browser closes when it is done.
//
//   node tools/strip.mjs [width] [height] [count] [outDir] [--reduced]
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { chromium } from "playwright-core";

const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const reduced = process.argv.includes("--reduced");
const [W = "1440", H = "900", N = "10", out = "lab/strip"] = args;
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
    deviceScaleFactor: 1,
    reducedMotion: reduced ? "reduce" : "no-preference",
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !/404/.test(m.text()) && errors.push(m.text()));
  await page.goto("http://localhost:4610/index.html", { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  // Wake every lazy image in the act so frames are not caught loading.
  await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll(".asm img")];
    imgs.forEach((i) => (i.loading = "eager"));
    await Promise.all(
      imgs.map((i) =>
        i.complete
          ? null
          : new Promise((r) => {
              i.onload = i.onerror = r;
            })
      )
    );
  });
  const files = [];
  for (let k = 0; k < n; k++) {
    const p = n === 1 ? 0 : k / (n - 1);
    await page.evaluate((p) => {
      const act = document.querySelector("[data-assembly]");
      const r = act.getBoundingClientRect();
      const top = scrollY + r.top;
      window.scrollTo({ top: Math.round(top + p * (r.height - innerHeight)), behavior: "instant" });
    }, p);
    await page.evaluate(() => window.__assembly?.settle?.());
    await page.waitForTimeout(250);
    const f = path.join(out, `f${String(k).padStart(2, "0")}.png`);
    await page.screenshot({ path: f });
    files.push(f);
  }
  const state = await page.evaluate(() => document.querySelector(".asm__stage")?.getAttribute("data-sc-verify-state"));
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
  console.log(path.join(out, "strip.png"), "last state:", state);
  if (errors.length) console.log("errors:", errors);
} finally {
  await browser.close();
}
