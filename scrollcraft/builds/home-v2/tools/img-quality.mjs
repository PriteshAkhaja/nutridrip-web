// For each photo on a page: loaded or not, the file width the browser chose,
// and how wide it is shown, at 1x and 2x. Plus any failed image requests.
import { chromium } from "playwright-core";
const BASE = process.env.BASE ?? "http://localhost:3001";
const pages = (process.env.PAGES ?? "/,/pricing,/drips,/drips/hydrate-plus,/about").split(",");
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  for (const dpr of [1, 2]) {
    const c = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: dpr });
    await c.addInitScript(() => {
      try {
        localStorage.setItem("nd_intro_at", String(Date.now()));
      } catch {}
    });
    const p = await c.newPage();
    const failed = [];
    p.on("response", (r) => {
      if (r.url().includes("/_next/image") && r.status() >= 400) failed.push(r.status() + " " + r.url().slice(0, 120));
    });
    for (const u of pages) {
      await p.goto(BASE + u, { waitUntil: "networkidle", timeout: 240000 });
      // Bring every photo into view so lazy ones load.
      const h = await p.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < h; y += 700) {
        await p.evaluate((y) => scrollTo(0, y), y);
        await p.waitForTimeout(120);
      }
      await p.waitForTimeout(1200);
      const rows = await p.evaluate(() =>
        [...document.querySelectorAll("main img, header img")]
          .map((i) => {
            const r = i.getBoundingClientRect();
            const w = Number(new URL(i.currentSrc || i.src, location.href).searchParams.get("w")) || null;
            const q = new URL(i.currentSrc || i.src, location.href).searchParams.get("q");
            const file = decodeURIComponent((i.currentSrc || i.src).replace(/.*url=/, "").replace(/&.*/, "")).replace(
              /.*\//,
              ""
            );
            return {
              file,
              shownW: Math.round(r.width),
              fileW: w,
              q,
              natural: i.naturalWidth,
              loaded: i.complete && i.naturalWidth > 0,
            };
          })
          .filter((x) => x.shownW > 60)
      );
      const bad = rows.filter((x) => !x.loaded || (x.fileW && x.fileW < x.shownW * devicePixelRatioGuess(dpr)));
      function devicePixelRatioGuess(d) {
        return d * 0.95;
      }
      console.log(
        `${dpr}x ${u.padEnd(22)} photos ${rows.length}  not loaded ${rows.filter((x) => !x.loaded).length}  too-small file ${rows.filter((x) => x.loaded && x.fileW && x.fileW < x.shownW * dpr * 0.95).length}`
      );
      for (const x of rows.slice(0, 4))
        console.log(`      ${x.file.padEnd(26)} shown ${x.shownW}px  file w=${x.fileW} q=${x.q}  loaded=${x.loaded}`);
    }
    if (failed.length) console.log("FAILED image requests:", failed.slice(0, 5));
    await c.close();
  }
} finally {
  await b.close();
}
