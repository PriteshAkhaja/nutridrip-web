// The Drips menu's Most booked thumbnails: size on screen, file fetched, crop.
import { chromium } from "playwright-core";
const BASE = process.env.BASE ?? "http://localhost:3000";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const c = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await c.addInitScript(() => {
    try {
      localStorage.setItem("nd_intro_at", String(Date.now()));
    } catch {}
  });
  const p = await c.newPage();
  await p.goto(BASE + "/drips/hydrate-plus", { waitUntil: "networkidle", timeout: 180000 });
  const t = p.locator('button[aria-label="Drips by goal"]');
  await t.click();
  await p.waitForTimeout(1500);
  const menu = p.locator("#" + (await t.getAttribute("aria-controls")));
  const thumbs = await menu.locator("img").evaluateAll((els) =>
    els.map((i) => {
      const r = i.getBoundingClientRect(),
        f = i.parentElement.getBoundingClientRect();
      return {
        box: [Math.round(r.width), Math.round(r.height)],
        frame: [Math.round(f.width), Math.round(f.height)],
        file: i.currentSrc.replace(/.*url=%2Fimages%2Fsite%2F/, ""),
        natural: [i.naturalWidth, i.naturalHeight],
        fit: getComputedStyle(i).objectFit,
      };
    })
  );
  console.log(JSON.stringify(thumbs, null, 0));
  await menu.locator("ul").last().screenshot({ path: "lab/every/menu-thumbs.png" });
} finally {
  await b.close();
}
