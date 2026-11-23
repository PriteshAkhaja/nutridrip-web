// The drip page's build stage, shot at positions through its scroll, as a contact sheet.
//   BASE=http://localhost:3001 SLUG=hydrate-plus W=1440 H=900 node tools/build-shots.mjs
import fs from "node:fs";
import sharp from "sharp";
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:3001";
const SLUG = process.env.SLUG ?? "hydrate-plus";
const W = Number(process.env.W ?? 1440);
const H = Number(process.env.H ?? 900);
const REDUCED = process.env.REDUCED === "1";
const STEPS = (process.env.STEPS ?? "0,0.06,0.14,0.22,0.3,0.4,0.5,0.6,0.7,0.78,0.86,0.94,1").split(",").map(Number);
const YS = process.env.YS ? process.env.YS.split(",").map(Number) : null;
const OUT = `lab/build/${SLUG}-${W}x${H}${REDUCED ? "-reduced" : ""}${process.env.TAG ? "-" + process.env.TAG : ""}`;
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
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 160));
  });
  await p.goto(`${BASE}/drips/${SLUG}${process.env.SUB ? "/" + process.env.SUB : ""}`, {
    waitUntil: "networkidle",
    timeout: 240000,
  });
  await p.waitForTimeout(1500);
  const info = await p.evaluate(() => {
    const bs = document.querySelector("[data-bs]");
    if (!bs) return null;
    const r = bs.getBoundingClientRect();
    return { top: r.top + scrollY, height: r.height, pinned: bs.classList.contains("is-pinned"), vh: innerHeight };
  });
  console.log("stage:", JSON.stringify(info));
  if (!info) throw new Error("no build stage on the page");
  const tiles = [];
  for (const s of YS ?? STEPS) {
    const y = YS ? s : info.pinned ? info.top + s * (info.height - info.vh) : info.top + s * info.height;
    await p.evaluate((v) => scrollTo(0, v), y);
    await p.waitForTimeout(REDUCED ? 300 : 700);
    const buf = await p.screenshot({ path: `${OUT}/p${String(Math.round(s * 100)).padStart(3, "0")}.png` });
    tiles.push(
      await sharp(buf)
        .resize({ width: Math.round(W > 800 ? 480 : 240) })
        .png()
        .toBuffer({ resolveWithObject: true })
    );
  }
  const cols = W > 800 ? 3 : 7;
  const tw = tiles[0].info.width,
    th = tiles[0].info.height;
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
