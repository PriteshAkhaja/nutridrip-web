// Ad hoc: the stand bag's wrapper box vs its picture's box, at rest (no transform).
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const p = await (await b.newContext({ viewport: { width: 1920, height: 920 } })).newPage();
  await p.goto("http://localhost:3001/drips/hydrate-plus", { waitUntil: "networkidle", timeout: 240000 });
  await p.waitForTimeout(1500);
  console.log(
    JSON.stringify(
      await p.evaluate(() => {
        const w = document.querySelector("[data-st-bag]");
        const t = w.style.transform;
        w.style.transform = "";
        const r = (el) => {
          const x = el.getBoundingClientRect();
          return { x: Math.round(x.left), y: Math.round(x.top), w: Math.round(x.width), h: Math.round(x.height) };
        };
        const out = { wrap: r(w), bag: r(w.querySelector("[data-st-bagin]")), img: r(w.querySelector(".nd-bag__img")) };
        w.style.transform = t;
        return out;
      })
    )
  );
} finally {
  await b.close();
}
