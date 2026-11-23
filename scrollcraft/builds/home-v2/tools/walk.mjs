// Scrolls a drip page the way a reader does (mouse-wheel steps with a pause
// between) and shoots every few steps, to catch what only shows mid-scroll.
//   SLUG=hydrate-plus W=1440 H=900 STEP=120 EVERY=2 PAUSE=260 UNTIL=after node tools/walk.mjs
// UNTIL: "after" stops a screen into the column after the stand; a number stops at that scrollY.
import fs from "node:fs";
import sharp from "sharp";
import { chromium } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:3001";
const SLUG = process.env.SLUG ?? "hydrate-plus";
const W = Number(process.env.W ?? 1440);
const H = Number(process.env.H ?? 900);
const STEP = Number(process.env.STEP ?? 120);
const EVERY = Number(process.env.EVERY ?? 2);
const PAUSE = Number(process.env.PAUSE ?? 260);
const PER_SHEET = Number(process.env.PER_SHEET ?? 15);
const OUT = `lab/walk/${SLUG}-${W}x${H}${process.env.TAG ? "-" + process.env.TAG : ""}`;
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const c = await b.newContext({ viewport: { width: W, height: H } });
  await c.addInitScript(() => {
    try {
      localStorage.setItem("nd_intro_at", String(Date.now()));
    } catch {}
  });
  const p = await c.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  p.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
  await p.goto(`${BASE}/drips/${SLUG}`, { waitUntil: "networkidle", timeout: 240000 });
  await p.waitForTimeout(1500);
  const until =
    process.env.UNTIL && process.env.UNTIL !== "after"
      ? Number(process.env.UNTIL)
      : await p.evaluate(() => {
          const a = document.querySelector(".dp__after");
          return a ? Math.round(a.getBoundingClientRect().top + scrollY) : document.documentElement.scrollHeight;
        });
  await p.mouse.move(W / 2, H / 2);
  const frames = [];
  let k = 0;
  for (;;) {
    const y = await p.evaluate(() => Math.round(scrollY));
    if (k % EVERY === 0) {
      const buf = await p.screenshot();
      const name = `f${String(frames.length).padStart(3, "0")}-y${y}.png`;
      fs.writeFileSync(`${OUT}/${name}`, buf);
      frames.push({ name, y, buf });
    }
    if (y >= until) break;
    await p.mouse.wheel(0, STEP);
    await p.waitForTimeout(PAUSE);
    k++;
    if (k > 400) break;
  }
  // Contact sheets, labelled with the scroll position.
  const tw = W > 800 ? 480 : 240;
  for (let s = 0; s * PER_SHEET < frames.length; s++) {
    const part = frames.slice(s * PER_SHEET, (s + 1) * PER_SHEET);
    const tiles = await Promise.all(
      part.map(async (f) => {
        const img = await sharp(f.buf).resize({ width: tw }).png().toBuffer({ resolveWithObject: true });
        const label = Buffer.from(
          `<svg width="${tw}" height="22"><rect width="${tw}" height="22" fill="#111"/><text x="6" y="16" font-size="14" fill="#fff" font-family="sans-serif">${f.name}</text></svg>`
        );
        const th = img.info.height + 22;
        const data = await sharp({ create: { width: tw, height: th, channels: 3, background: "#111" } })
          .composite([
            { input: label, left: 0, top: 0 },
            { input: img.data, left: 0, top: 22 },
          ])
          .png()
          .toBuffer();
        return { data, th };
      })
    );
    const cols = W > 800 ? 3 : 5;
    const th = tiles[0].th;
    await sharp({
      create: {
        width: cols * (tw + 6),
        height: Math.ceil(tiles.length / cols) * (th + 6),
        channels: 3,
        background: "#999",
      },
    })
      .composite(
        tiles.map((t, i) => ({ input: t.data, left: (i % cols) * (tw + 6), top: Math.floor(i / cols) * (th + 6) }))
      )
      .png()
      .toFile(`${OUT}/sheet-${s}.png`);
  }
  console.log("frames:", frames.length, "until:", until);
  console.log("errors:", errors.length ? errors.join(" | ") : "none");
  console.log("out:", OUT);
} finally {
  await b.close();
}
