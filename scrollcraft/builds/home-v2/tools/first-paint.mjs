// What a reload paints before the app's JavaScript runs: Next's chunks are
// blocked, so only the HTML, the CSS and inline scripts take effect. Ad hoc.
//   node tools/first-paint.mjs http://localhost:3001/drips/hydrate-plus out.png
import { chromium } from "playwright-core";
const [url, out] = process.argv.slice(2);
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await c.route(
    (u) => u.pathname.startsWith("/_next/static/chunks/") && u.pathname.endsWith(".js"),
    (r) => r.abort()
  );
  const p = await c.newPage();
  await p.goto(url, { waitUntil: "load", timeout: 240000 });
  await p.waitForTimeout(800);
  console.log(
    JSON.stringify(
      await p.evaluate(() => {
        const bs = document.querySelector("[data-bs]");
        return { pinned: bs?.classList.contains("is-pinned"), height: bs?.getBoundingClientRect().height };
      })
    )
  );
  await p.screenshot({ path: out });
} finally {
  await b.close();
}
