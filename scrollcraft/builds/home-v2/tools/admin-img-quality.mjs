// Admin → Site images: which file the browser picks for each card photo, vs how big it is drawn.
import { chromium } from "playwright-core";
const BASE = process.env.BASE ?? "http://localhost:3001";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  for (const dpr of [1, 1.25, 1.5, 2]) {
    const c = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
    const p = await c.newPage();
    await p.request.post(BASE + "/api/auth/login", { data: { email: "admin@nutridrip.com", password: "admin123" } });
    await p.goto(BASE + "/admin/images#page-pricing", { waitUntil: "networkidle", timeout: 240000 });
    await p.waitForTimeout(1000);
    const r = await p.evaluate(() => {
      const i = document.querySelector('[id="pricing.hero"] img');
      const u = new URL(i.currentSrc, location.href),
        rect = i.getBoundingClientRect();
      return {
        shown: Math.round(rect.width) + "×" + Math.round(rect.height),
        fileW: u.searchParams.get("w"),
        q: u.searchParams.get("q"),
        natural: i.naturalWidth,
        sizes: i.sizes,
      };
    });
    console.log(`DPR ${dpr}:`, JSON.stringify(r));
    await c.close();
  }
} finally {
  await b.close();
}
