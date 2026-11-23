// Ad hoc: which elements a page's layout shifts move, and by how much (cold cache, intro already seen).
import { chromium } from "playwright-core";
const URL = process.env.URL ?? "http://localhost:3005/drips/hydrate-plus";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("nd_intro_at", String(Date.now()));
    } catch {}
    window.__s = [];
    new PerformanceObserver((l) => {
      for (const e of l.getEntries())
        window.__s.push({
          t: Math.round(e.startTime),
          v: +e.value.toFixed(4),
          src: (e.sources ?? []).map((s) => {
            const n = s.node;
            const d =
              n && n.nodeType === 1
                ? `${n.tagName.toLowerCase()}.${[...n.classList].slice(0, 3).join(".")}`
                : n
                  ? n.nodeName
                  : "?";
            return `${d} ${s.previousRect.y | 0}->${s.currentRect.y | 0} h${s.previousRect.height | 0}->${s.currentRect.height | 0} x${s.previousRect.x | 0}->${s.currentRect.x | 0}`;
          }),
        });
    }).observe({ type: "layout-shift", buffered: true });
  });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: "load" });
  await p.waitForTimeout(3000);
  console.log(JSON.stringify(await p.evaluate(() => window.__s), null, 1));
} finally {
  await b.close();
}
