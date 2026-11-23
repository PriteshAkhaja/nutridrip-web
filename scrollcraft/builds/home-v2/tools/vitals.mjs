// Ad hoc: LCP, CLS (at load, and after a scroll through the page), FCP and TTFB, cold cache, intro already seen.
// BASE=http://localhost:3005 PAGES=/drips/myers-revive,/ node vitals.mjs
import { chromium } from "playwright-core";
const BASE = process.env.BASE ?? "http://localhost:3005";
const PAGES = (process.env.PAGES ?? "/drips/myers-revive,/drips/hydrate-plus,/,/drips").split(",");
const RUNS = Number(process.env.RUNS ?? 2);
const SIZES = [
  { name: "desktop 1440x900", viewport: { width: 1440, height: 900 }, mobile: false },
  { name: "phone 390x844", viewport: { width: 390, height: 844 }, mobile: true },
];
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const fmt = (n) => (n == null ? "—" : Math.round(n));
try {
  for (const s of SIZES) {
    for (const path of PAGES) {
      const runs = [];
      for (let r = 0; r < RUNS; r++) {
        const ctx = await b.newContext({ viewport: s.viewport, isMobile: s.mobile, hasTouch: s.mobile });
        await ctx.addInitScript(() => {
          try {
            localStorage.setItem("nd_intro_at", String(Date.now()));
          } catch {}
          window.__v = { lcp: 0, lcpEl: "", cls: 0 };
          new PerformanceObserver((l) => {
            for (const e of l.getEntries()) {
              window.__v.lcp = e.startTime;
              const el = e.element;
              window.__v.lcpEl = el
                ? `${el.tagName.toLowerCase()}.${[...(el.classList ?? [])].slice(0, 2).join(".")}`
                : (e.url ?? "");
            }
          }).observe({ type: "largest-contentful-paint", buffered: true });
          new PerformanceObserver((l) => {
            for (const e of l.getEntries()) if (!e.hadRecentInput) window.__v.cls += e.value;
          }).observe({ type: "layout-shift", buffered: true });
        });
        const p = await ctx.newPage();
        await p.goto(BASE + path, { waitUntil: "load", timeout: 240000 });
        await p.waitForTimeout(3000);
        const load = await p.evaluate(() => {
          const nav = performance.getEntriesByType("navigation")[0];
          const fcp = performance.getEntriesByName("first-contentful-paint")[0];
          return {
            ttfb: nav?.responseStart,
            fcp: fcp?.startTime,
            lcp: window.__v.lcp,
            lcpEl: window.__v.lcpEl,
            cls: window.__v.cls,
          };
        });
        // A reader's scroll through the first screens, then the CLS again.
        await p.mouse.move(s.viewport.width / 2, s.viewport.height / 2);
        for (let k = 0; k < 30; k++) {
          await p.mouse.wheel(0, 120);
          await p.waitForTimeout(80);
        }
        await p.waitForTimeout(800);
        load.clsScrolled = await p.evaluate(() => window.__v.cls);
        runs.push(load);
        await ctx.close();
      }
      const best = runs.reduce((a, x) => (x.lcp < a.lcp ? x : a));
      const worstCls = Math.max(...runs.map((x) => x.clsScrolled));
      console.log(
        `${s.name} ${path}: LCP ${runs.map((x) => fmt(x.lcp)).join("/")} ms (${best.lcpEl}), FCP ${runs.map((x) => fmt(x.fcp)).join("/")}, TTFB ${runs.map((x) => fmt(x.ttfb)).join("/")}, CLS load ${runs.map((x) => x.cls.toFixed(3)).join("/")}, after scroll ${worstCls.toFixed(3)}`
      );
    }
  }
} finally {
  await b.close();
}
