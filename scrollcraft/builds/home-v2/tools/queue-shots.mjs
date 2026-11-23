// Scrolls a drip page to one place at once (a fast scroll) and shoots the bag
// column every STEP ms, to see the bottles go in one at a time. Ad hoc.
import fs from "node:fs";
import sharp from "sharp";
import { chromium } from "playwright-core";
const BASE = process.env.BASE ?? "http://localhost:3001";
const SLUG = process.env.SLUG ?? "hydrate-plus";
const Y = Number(process.env.Y ?? 700);
const STEP = Number(process.env.STEP ?? 280);
const N = Number(process.env.N ?? 12);
const OUT = `lab/queue/${SLUG}-${Y}`;
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await c.addInitScript(() => {
    try {
      localStorage.setItem("nd_intro_at", String(Date.now()));
    } catch {}
  });
  const p = await c.newPage();
  await p.goto(`${BASE}/drips/${SLUG}`, { waitUntil: "networkidle", timeout: 240000 });
  await p.waitForTimeout(1500);
  await p.evaluate((v) => scrollTo(0, v), Y);
  const tiles = [];
  for (let k = 0; k < N; k++) {
    await p.waitForTimeout(STEP);
    const moving = await p.evaluate(
      () =>
        [...document.querySelectorAll("[data-rb]")].filter((el) => {
          const o = Number(getComputedStyle(el).opacity);
          // In the air: moved off its shelf place and not yet gone.
          const m = el.style.transform.match(/translate3d\(([-\d.]+)px, ?([-\d.]+)px/);
          return !!m && (Math.abs(+m[1]) > 1 || Math.abs(+m[2]) > 1) && o > 0.05;
        }).length
    );
    const buf = await p.screenshot({ clip: { x: 0, y: 0, width: 860, height: 900 } });
    console.log(`t=${(k + 1) * STEP}ms bottles in the air: ${moving}`);
    tiles.push(await sharp(buf).resize({ width: 287 }).png().toBuffer({ resolveWithObject: true }));
  }
  const tw = tiles[0].info.width,
    th = tiles[0].info.height,
    cols = 6;
  await sharp({
    create: { width: cols * (tw + 4), height: Math.ceil(N / cols) * (th + 4), channels: 3, background: "#999" },
  })
    .composite(
      tiles.map((t, i) => ({ input: t.data, left: (i % cols) * (tw + 4), top: Math.floor(i / cols) * (th + 4) }))
    )
    .png()
    .toFile(`${OUT}/sheet.png`);
  console.log("sheet:", `${OUT}/sheet.png`);
} finally {
  await b.close();
}
