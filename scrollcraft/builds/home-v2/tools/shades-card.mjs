// The "Shades worked out" card on Admin → Settings at 1440 and 390, with its spacing measured.
import sharp from "sharp";
import { chromium } from "playwright-core";
const BASE = process.env.BASE ?? "http://localhost:3000";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const shots = [];
try {
  for (const w of [1440, 1024, 390]) {
    const c = await b.newContext({ viewport: { width: w, height: 900 } });
    const p = await c.newPage();
    await p.request.post(BASE + "/api/auth/login", { data: { email: "admin@nutridrip.com", password: "admin123" } });
    await p.goto(BASE + "/admin/settings", { waitUntil: "networkidle", timeout: 180000 });
    const card = p.locator("text=Shades worked out").locator("xpath=ancestor::div[contains(@class,'rounded')][1]");
    await card.scrollIntoViewIfNeeded();
    const m = await card.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const grids = [...el.querySelectorAll(":scope > div.grid")].map((g) => g.getBoundingClientRect());
      const label = [...el.querySelectorAll(":scope > span.t-micro")].map((s) => s.getBoundingClientRect());
      const sw = el.querySelectorAll(":scope > div.grid")[1]?.firstElementChild?.getBoundingClientRect();
      return {
        card: [Math.round(r.width), Math.round(r.height)],
        gapGrid1ToLabel: label[0] ? Math.round(label[0].top - grids[0].bottom) : null,
        gapLabelToGrid2: label[0] ? Math.round(grids[1].top - label[0].bottom) : null,
        bottomPad: Math.round(r.bottom - grids[1].bottom),
        swatchW: sw ? Math.round(sw.width) : null,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    console.log(w, JSON.stringify(m));
    shots.push(await card.screenshot());
    await c.close();
  }
} finally {
  await b.close();
}
const tiles = await Promise.all(shots.map((s) => sharp(s).png().toBuffer({ resolveWithObject: true })));
let x = 0;
const H = Math.max(...tiles.map((t) => t.info.height));
const comp = tiles.map((t) => {
  const r = { input: t.data, left: x, top: 0 };
  x += t.info.width + 10;
  return r;
});
await sharp({ create: { width: x, height: H, channels: 3, background: "#999" } })
  .composite(comp)
  .png()
  .toFile("lab/every/shades-card.png");
