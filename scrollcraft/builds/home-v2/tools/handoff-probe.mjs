// Ad hoc: one wheel notch at a time, log when the last row lights and when the scene starts.
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
  let lit = -1;
  let moved = -1;
  for (let k = 0; k < 60; k++) {
    const s = await p.evaluate(() => {
      const rows = [...document.querySelectorAll("[data-ing]")];
      const last = rows.at(-1);
      const st = document.querySelector("[data-st]");
      return {
        y: Math.round(scrollY),
        lit: last.classList.contains("is-lit"),
        started: st.getBoundingClientRect().top < 0,
      };
    });
    if (s.lit && lit < 0) lit = k;
    if (s.started && moved < 0) moved = k;
    if (lit >= 0 && moved >= 0) break;
    await p.mouse.wheel(0, 100);
    await p.waitForTimeout(150);
  }
  console.log(
    `${SLUG} ${W}x${H}: last row lit at notch ${lit}, scene starts at notch ${moved} (${moved - lit} notch(es) later)`
  );
} finally {
  await b.close();
}
