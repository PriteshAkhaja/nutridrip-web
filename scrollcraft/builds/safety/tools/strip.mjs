// The checklist section at evenly spaced positions of its reading travel.
//   node tools/strip.mjs [width] [height] [count] [outDir] [--reduced]   (BASE, PAGE, SEL env)
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { chromium } from "playwright-core";
const args = process.argv.slice(2).filter((a) => !a.startsWith("--"));
const reduced = process.argv.includes("--reduced");
const [W = "1440", H = "900", N = "8", out = "lab/strip"] = args;
const w = +W,
  h = +H,
  n = +N;
const BASE = process.env.BASE ?? "http://localhost:4620",
  PAGE = process.env.PAGE ?? "/index.html";
const SEL = process.env.SEL ?? "[data-cl-list]";
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const c = await b.newContext({
    viewport: { width: w, height: h },
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
  p.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 160)));
  await p.goto(BASE + PAGE, { waitUntil: "networkidle", timeout: 120000 });
  await p.evaluate(async () => {
    await document.fonts.ready;
  });
  await p.waitForTimeout(800);
  const files = [];
  for (let k = 0; k < n; k++) {
    const t = k / (n - 1);
    // The reading line (45% down) at the top of the list, then through it to its bottom.
    await p.evaluate(
      ([sel, t]) => {
        const l = document.querySelector(sel);
        const r = l.getBoundingClientRect();
        const y = scrollY + r.top + t * r.height - innerHeight * 0.45;
        scrollTo({ top: Math.round(y), behavior: "instant" });
      },
      [SEL, t]
    );
    await p.waitForTimeout(700);
    const f = path.join(out, `f${String(k).padStart(2, "0")}.png`);
    await p.screenshot({ path: f });
    files.push(f);
  }
  const cols = 4,
    tw = Math.round(w / (w > 1000 ? 3.2 : 1.6)),
    th = Math.round((tw * h) / w),
    gap = 8,
    lab = 22;
  const rows = Math.ceil(n / cols);
  const tiles = await Promise.all(files.map((f) => sharp(f).resize(tw, th).png().toBuffer()));
  const labels = files.map((_, k) =>
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${tw}" height="${lab}"><text x="2" y="16" font-family="Arial" font-size="14" fill="#333">${Math.round((k / (n - 1)) * 100)}% through the list</text></svg>`
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
  console.log(path.join(out, "strip.png"), "errors:", errors.length ? errors : "none");
} finally {
  await b.close();
}
