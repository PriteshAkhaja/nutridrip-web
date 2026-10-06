// LCP and CLS for the home page, cold (fresh context, no cache): on load, and
// again after scrolling the whole assembly act. Phone runs at 4x CPU slowdown.
//   BASE=http://localhost:3100 node tools/vitals-app.mjs
import { chromium } from "playwright-core";
const BASE = process.env.BASE ?? "http://localhost:3000";
const RUNS = [
  { name: "1440x900", w: 1440, h: 900, cpu: 1 },
  { name: "390x844 4x CPU", w: 390, h: 844, cpu: 4, mobile: true },
];
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  for (const r of RUNS) {
    const c = await b.newContext({
      viewport: { width: r.w, height: r.h },
      isMobile: !!r.mobile,
      hasTouch: !!r.mobile,
      deviceScaleFactor: r.mobile ? 3 : 1,
    });
    await c.addInitScript(() => {
      try {
        localStorage.setItem("nd_intro_at", String(Date.now()));
      } catch {}
      window.__v = { lcp: 0, lcpEl: "", cls: 0 };
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) {
          window.__v.lcp = e.startTime;
          const el = e.element;
          window.__v.lcpEl = el
            ? el.tagName +
              (el.id ? "#" + el.id : "") +
              " " +
              (el.textContent || el.getAttribute("src") || "").trim().slice(0, 40)
            : "?";
        }
      }).observe({ type: "largest-contentful-paint", buffered: true });
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) if (!e.hadRecentInput) window.__v.cls += e.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    const p = await c.newPage();
    const cdp = await c.newCDPSession(p);
    if (r.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: r.cpu });
    const t0 = Date.now();
    await p.goto(BASE + "/", { waitUntil: "load", timeout: 180000 });
    await p.waitForTimeout(2500);
    const onLoad = await p.evaluate(() => ({ ...window.__v }));
    // Scroll the act through, as a reader would, in steps.
    await p.evaluate(async () => {
      const a = document.querySelector("section[aria-labelledby='home-title']");
      const end = scrollY + a.getBoundingClientRect().bottom;
      for (let y = 0; y < end; y += innerHeight / 3) {
        scrollTo({ top: y, behavior: "instant" });
        await new Promise((r) => setTimeout(r, 120));
      }
    });
    await p.waitForTimeout(1500);
    const after = await p.evaluate(() => ({ ...window.__v }));
    console.log(
      `${r.name.padEnd(16)} LCP ${Math.round(onLoad.lcp)} ms (${onLoad.lcpEl})  CLS load ${onLoad.cls.toFixed(3)}  CLS after act ${after.cls.toFixed(3)}  load ${Date.now() - t0} ms total`
    );
    await c.close();
  }
} finally {
  await b.close();
}
