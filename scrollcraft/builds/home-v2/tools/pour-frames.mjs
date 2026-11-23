// Ad hoc: one bottle's pour, frame by frame (every STEP ms), on one contact sheet.
import { chromium } from "playwright-core";
const SLUG = process.env.SLUG ?? "myers-revive";
const W = Number(process.env.W ?? 1920);
const H = Number(process.env.H ?? 920);
const STEP = Number(process.env.STEP ?? 110);
const ROW = Number(process.env.ROW ?? 2);
const OUT = process.env.OUT;
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const ZOOM = !!process.env.ZOOM;
  const p = await (
    await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: ZOOM ? 2 : 1 })
  ).newPage();
  await p.goto(`http://localhost:3001/drips/${SLUG}`, { waitUntil: "networkidle", timeout: 240000 });
  await p.waitForTimeout(1000);
  // Just above where row ROW is read, then let everything before it settle.
  const y = await p.evaluate((i) => {
    const r = document.querySelectorAll("[data-ing]")[i].getBoundingClientRect();
    return r.top + scrollY - innerHeight * 0.62 - 20;
  }, ROW);
  await p.evaluate((y) => scrollTo(0, y), y);
  await p.waitForTimeout(3000);
  const clip = await p.evaluate((zoom) => {
    if (zoom) {
      // The bag's lower half and the shelf's foot: where the bottle docks and the colour blooms.
      const g = document.querySelector("[data-dp-bag]").getBoundingClientRect();
      const r = document.querySelector(".dp__rig").getBoundingClientRect();
      const top = g.top + g.height * 0.45;
      return {
        x: Math.max(0, r.left - 20),
        y: top,
        width: g.right - r.left + 40,
        height: Math.min(innerHeight - top, g.height * 0.62),
      };
    }
    const r = document.querySelector(".dp__rig").getBoundingClientRect();
    return {
      x: Math.max(0, r.left - 40),
      y: Math.max(0, r.top - 40),
      width: r.width + 80,
      height: Math.min(innerHeight - Math.max(0, r.top - 40), r.height + 80),
    };
  }, ZOOM);
  await p.evaluate((y) => scrollTo(0, y + 60), y);
  const shots = [];
  for (let k = 0; k < Number(process.env.N ?? 12); k++) {
    shots.push((await p.screenshot({ clip })).toString("base64"));
    await p.waitForTimeout(STEP);
  }
  const html = `<body style="margin:0;background:#222;display:flex;flex-wrap:wrap;gap:4px">${shots
    .map(
      (s, k) =>
        `<figure style="margin:0;color:#eee;font:12px sans-serif"><img src="data:image/png;base64,${s}" style="height:300px;display:block">~${k * STEP}ms</figure>`
    )
    .join("")}</body>`;
  const q = await (await b.newContext({ viewport: { width: 1900, height: 900 } })).newPage();
  await q.setContent(html);
  await q.waitForTimeout(400);
  await q.screenshot({ path: OUT, fullPage: true });
} finally {
  await b.close();
}
