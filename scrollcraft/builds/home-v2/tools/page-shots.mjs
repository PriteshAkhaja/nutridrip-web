// A drip page shot at points down its whole scroll, as a contact sheet.
//   SLUG=hydrate-plus SUB=preview W=1440 H=900 node tools/page-shots.mjs
// FRACS: shares of the page's scroll (default spread), or YS: exact scrollY values.
import fs from "node:fs";
import sharp from "sharp";
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:3001";
const SLUG = process.env.SLUG ?? "hydrate-plus";
const SUB = process.env.SUB ? "/" + process.env.SUB : "";
const W = Number(process.env.W ?? 1440);
const H = Number(process.env.H ?? 900);
const REDUCED = process.env.REDUCED === "1";
const FRACS = (process.env.FRACS ?? "0,0.04,0.08,0.12,0.16,0.2,0.26,0.32,0.38,0.44,0.5,0.6").split(",").map(Number);
const OUT = `lab/page/${SLUG}-${W}x${H}${REDUCED ? "-reduced" : ""}${process.env.TAG ? "-" + process.env.TAG : ""}`;
fs.mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const c = await b.newContext({
    viewport: { width: W, height: H },
    reducedMotion: REDUCED ? "reduce" : "no-preference",
  });
  await c.addInitScript(() => {
    try {
      localStorage.setItem("nd_intro_at", String(Date.now()));
    } catch {}
  });
  const p = await c.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  p.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
  await p.goto(`${BASE}/drips/${SLUG}${SUB}`, { waitUntil: "networkidle", timeout: 240000 });
  await p.waitForTimeout(1500);
  const max = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const marks = await p.evaluate(() => {
    const y = (s) => {
      const el = document.querySelector(s);
      return el ? Math.round(el.getBoundingClientRect().top + scrollY) : null;
    };
    return { list: y("[data-ings]"), stand: y("[data-st]"), after: y(".dp__after") };
  });
  console.log("scroll max:", max, "marks:", JSON.stringify(marks));
  const ys = process.env.YS ? process.env.YS.split(",").map(Number) : FRACS.map((f) => Math.round(f * max));
  const tiles = [];
  for (const y of ys) {
    await p.evaluate((v) => scrollTo(0, v), y);
    await p.waitForTimeout(REDUCED ? 300 : 800);
    const buf = await p.screenshot({ path: `${OUT}/y${String(y).padStart(5, "0")}.png` });
    tiles.push(
      await sharp(buf)
        .resize({ width: W > 800 ? 480 : 240 })
        .png()
        .toBuffer({ resolveWithObject: true })
    );
  }
  const cols = W > 800 ? 3 : 6;
  const tw = tiles[0].info.width;
  const th = tiles[0].info.height;
  const rows = Math.ceil(tiles.length / cols);
  await sharp({ create: { width: cols * (tw + 6), height: rows * (th + 6), channels: 3, background: "#999" } })
    .composite(
      tiles.map((t, i) => ({ input: t.data, left: (i % cols) * (tw + 6), top: Math.floor(i / cols) * (th + 6) }))
    )
    .png()
    .toFile(`${OUT}/sheet.png`);
  console.log("errors:", errors.length ? errors.join(" | ") : "none");
  console.log("sheet:", `${OUT}/sheet.png`);
} finally {
  await b.close();
}
