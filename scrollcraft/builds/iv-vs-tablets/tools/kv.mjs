import { chromium } from "file:///C:/Trakshym/Nutridrip/nutridrip-new/scrollcraft/builds/home-v2/node_modules/playwright-core/index.mjs";
const [, , URL, W, H, CPU = "1"] = process.argv;
const b = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
try {
  const ctx = await b.newContext({ viewport: { width: +W, height: +H }, isMobile: +W < 900, hasTouch: +W < 900 });
  await ctx.addInitScript(() => {
    window.__v = { lcp: 0, el: "", cls: 0 };
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        window.__v.lcp = e.startTime;
        window.__v.el = e.element ? e.element.tagName + "." + String(e.element.className).split(" ")[0] : e.url;
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (!e.hadRecentInput) window.__v.cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
  });
  const p = await ctx.newPage();
  if (+CPU > 1) {
    const c = await ctx.newCDPSession(p);
    await c.send("Emulation.setCPUThrottlingRate", { rate: +CPU });
  }
  await p.goto(URL, { waitUntil: "load" });
  await p.waitForTimeout(1500);
  const load = await p.evaluate(() => ({ ...window.__v }));
  await p.evaluate(async () => {
    const m = document.documentElement.scrollHeight - innerHeight;
    for (let y = 0; y <= m; y += Math.round(innerHeight * 0.35)) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 50));
    }
  });
  await p.waitForTimeout(500);
  const cls = await p.evaluate(() => window.__v.cls);
  const out = {
    W,
    CPU,
    lcpMs: Math.round(load.lcp),
    lcpEl: load.el,
    clsLoad: +load.cls.toFixed(4),
    clsScroll: +cls.toFixed(4),
  };
  if (CPU === "1") {
    await p.evaluate(() => scrollTo(0, 0));
    await p.waitForTimeout(300);
    const stops = [];
    for (let i = 0; i < 140; i++) {
      await p.keyboard.press("Tab");
      await p.waitForTimeout(950);
      const s = await p.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const r = el.getBoundingClientRect();
        let o = 1,
          n = el,
          vis = true;
        while (n && n.nodeType === 1) {
          const cs = getComputedStyle(n);
          o *= +cs.opacity;
          if (cs.visibility === "hidden" || cs.display === "none") vis = false;
          n = n.parentElement;
        }
        return {
          t: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40),
          on: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth,
          o: +o.toFixed(2),
          vis,
        };
      });
      if (!s) break;
      if (stops.length > 5 && s.t === stops[0].t) break;
      stops.push(s);
    }
    out.tabStops = stops.length;
    out.badStops = stops.filter((s) => !s.on || s.o < 0.85 || !s.vis).slice(0, 12);
  }
  console.log(JSON.stringify(out));
} finally {
  await b.close();
}
