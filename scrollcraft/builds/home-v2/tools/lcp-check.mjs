// Which <img> elements on a page load a given photo, lazily or not, and what
// the Next LCP warning says. PATH=/drips/hydrate-plus PHOTO=goal-hydration
import { chromium } from "playwright-core";
const BASE = process.env.BASE ?? "http://localhost:3000";
const PATH = process.env.PATH_ ?? "/drips/hydrate-plus";
const PHOTO = process.env.PHOTO ?? "goal-hydration";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  for (const w of [1440, 390]) {
    const c = await b.newContext({ viewport: { width: w, height: w > 500 ? 900 : 844 } });
    await c.addInitScript(() => {
      try {
        localStorage.setItem("nd_intro_at", String(Date.now()));
      } catch {}
    });
    const p = await c.newPage();
    const warns = [];
    p.on("console", (m) => {
      if (/Largest Contentful Paint/.test(m.text())) warns.push(m.text().split("\n")[0]);
    });
    await p.goto(BASE + PATH, { waitUntil: "networkidle", timeout: 180000 });
    await p.waitForTimeout(2500);
    const imgs = await p.evaluate(
      (photo) =>
        [...document.querySelectorAll("img")]
          .filter((i) => i.src.includes(photo))
          .map((i) => {
            const r = i.getBoundingClientRect();
            const where = i.closest("header")
              ? "header"
              : i.closest("[id]")?.id || i.closest("section")?.className.slice(0, 40) || "?";
            return {
              loading: i.getAttribute("loading"),
              fetchpriority: i.getAttribute("fetchpriority"),
              sizes: i.sizes,
              where,
              box: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
            };
          }),
      PHOTO
    );
    const lcp = await p.evaluate(
      () =>
        new Promise((res) =>
          new PerformanceObserver((l) => {
            const e = l.getEntries().at(-1);
            res({
              t: Math.round(e.startTime),
              el: e.element?.tagName,
              src: (e.element?.currentSrc || e.url || "").slice(0, 90),
            });
          }).observe({ type: "largest-contentful-paint", buffered: true })
        )
    );
    console.log(w, JSON.stringify({ imgs, lcp, warns }));
    await c.close();
  }
} finally {
  await b.close();
}
