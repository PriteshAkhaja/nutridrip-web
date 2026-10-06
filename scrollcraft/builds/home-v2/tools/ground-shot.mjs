// The act's deep ground at two moments (the point, the bag), for a before/after.
import { chromium } from "playwright-core";
const out = process.argv[2];
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await c.addInitScript(() => {
    try {
      localStorage.setItem("nd_intro_at", String(Date.now()));
    } catch {}
  });
  const p = await c.newPage();
  await p.goto("http://localhost:3000/", { waitUntil: "networkidle", timeout: 120000 });
  await p.waitForTimeout(1200);
  for (const t of [0.46, 0.7]) {
    await p.evaluate((t) => {
      const a = document.querySelector("section[aria-labelledby='home-title']");
      const r = a.getBoundingClientRect();
      scrollTo({ top: Math.round(scrollY + r.top + t * (r.height - innerHeight)), behavior: "instant" });
    }, t);
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${out}-${t}.png` });
  }
} finally {
  await b.close();
}
