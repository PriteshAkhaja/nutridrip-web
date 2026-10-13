// Close-ups of the spots the user flagged, in the theme saved on the server:
// the Drips menu with a tile hovered, the comparison ticks, the quiz retake notice.
import sharp from "sharp";
import { chromium } from "playwright-core";
const BASE = process.env.BASE ?? "http://localhost:3000";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const shots = [];
try {
  let c = await b.newContext({ viewport: { width: 1280, height: 800 } });
  await c.addInitScript(() => {
    try {
      localStorage.setItem("nd_intro_at", String(Date.now()));
    } catch {}
  });
  let p = await c.newPage();
  await p.goto(BASE + "/how-it-works", { waitUntil: "networkidle", timeout: 180000 });
  await p.locator('button[aria-label="Drips by goal"]').click();
  await p.waitForTimeout(700);
  const tile = p
    .locator("#" + (await p.locator('button[aria-label="Drips by goal"]').getAttribute("aria-controls")) + " a")
    .first();
  await tile.hover();
  await p.waitForTimeout(500);
  const tileBg = await tile.evaluate((e) => getComputedStyle(e).backgroundColor);
  const glide = await p.evaluate(() => getComputedStyle(document.querySelector(".nav-glide")).backgroundColor);
  console.log("menu tile hover:", tileBg, " nav hover pill:", glide);
  shots.push(await p.screenshot({ clip: { x: 0, y: 0, width: 1000, height: 470 } }));
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  const table = p.locator("[aria-label^='Comparison of NutriDrip']").first();
  await table.scrollIntoViewIfNeeded();
  await p.waitForTimeout(800);
  const marks = await table
    .locator("[role=img][aria-label=Yes]")
    .evaluateAll((els) => [...new Set(els.map((e) => getComputedStyle(e).backgroundColor))]);
  console.log("comparison ticks:", marks.join("  "));
  shots.push(await table.screenshot());
  await c.close();
  c = await b.newContext({ viewport: { width: 900, height: 900 } });
  p = await c.newPage();
  const q = await (await p.request.post(BASE + "/api/auth/otp/request", { data: { phone: "+919844471234" } })).json();
  await p.request.post(BASE + "/api/auth/otp/verify", { data: { phone: "+919844471234", code: q.data?.devCode } });
  await p.goto(BASE + "/quiz?retake=1", { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  const note = p.locator("text=Answering again").locator("xpath=..");
  if (await note.count()) {
    console.log(
      "retake notice:",
      await note.evaluate((e) => {
        const s = getComputedStyle(e);
        return s.backgroundColor + " border " + s.borderTopColor;
      })
    );
  } else console.log("retake notice: not shown (no earlier answers waiting)");
  shots.push(await p.screenshot({ clip: { x: 0, y: 0, width: 900, height: 600 } }));
  await c.close();
} finally {
  await b.close();
}
const tiles = await Promise.all(
  shots.map((s) => sharp(s).resize({ height: 420 }).png().toBuffer({ resolveWithObject: true }))
);
let x = 0;
const comp = tiles.map((t) => {
  const r = { input: t.data, left: x, top: 0 };
  x += t.info.width + 8;
  return r;
});
await sharp({ create: { width: x, height: 420, channels: 3, background: "#999" } })
  .composite(comp)
  .png()
  .toFile("lab/every/flagged.png");
