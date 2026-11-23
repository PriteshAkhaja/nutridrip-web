// Ad hoc: per wheel notch, where the last ingredient card sits, how many rows are lit,
// and whether the stand scene has started. Held = the card's top does not move.
import { chromium } from "playwright-core";
const SLUG = process.env.SLUG ?? "hydrate-plus";
const W = Number(process.env.W ?? 1920);
const H = Number(process.env.H ?? 920);
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const p = await (await b.newContext({ viewport: { width: W, height: H } })).newPage();
  await p.goto(`http://localhost:3001/drips/${SLUG}`, { waitUntil: "networkidle", timeout: 240000 });
  await p.waitForTimeout(1500);
  await p.mouse.move(W / 2, H / 2);
  const out = [];
  for (let k = 0; k < 70; k++) {
    const s = await p.evaluate(() => {
      const rows = [...document.querySelectorAll("[data-ing]")];
      const last = rows.at(-1).getBoundingClientRect();
      const main = document.querySelector(".dp__main");
      const st = document.querySelector("[data-st]").getBoundingClientRect();
      return {
        y: Math.round(scrollY),
        top: Math.round(last.top),
        bottom: Math.round(last.bottom),
        lit: rows.filter((r) => r.classList.contains("is-lit")).length,
        n: rows.length,
        op: getComputedStyle(main).opacity,
        st: st.top < 0,
      };
    });
    out.push(s);
    if (s.op !== "1" && Number(s.op) < 0.05) break;
    await p.mouse.wheel(0, 100);
    await p.waitForTimeout(160);
  }
  for (const [k, s] of out.entries())
    if (s.bottom < H + 300)
      console.log(
        `notch ${k} y${s.y} last card ${s.top}-${s.bottom} lit ${s.lit}/${s.n} list op ${(+s.op).toFixed(2)}${s.st ? " SCENE" : ""}`
      );
} finally {
  await b.close();
}
