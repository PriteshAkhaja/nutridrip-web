// Ad hoc: bursts of fast wheel notches through a drip page; after each burst, how many ingredient rows are read.
// With the stops (preview), each burst inside the list should read exactly one more row.
import { chromium } from "playwright-core";
const URL = process.env.URL ?? "http://localhost:3001/drips/myers-revive/preview";
const W = Number(process.env.W ?? 1440);
const H = Number(process.env.H ?? 900);
const BURST = Number(process.env.BURST ?? 6);
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const ctx = await b.newContext({ viewport: { width: W, height: H } });
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem("nd_intro_at", String(Date.now()));
    } catch {}
  });
  const p = await ctx.newPage();
  await p.goto(URL, { waitUntil: "networkidle", timeout: 240000 });
  await p.waitForTimeout(1500);
  await p.mouse.move(W / 2, H / 2);
  const read = () =>
    p.evaluate(() => ({
      y: Math.round(scrollY),
      lit: [...document.querySelectorAll("[data-ing]")].filter((r) => r.classList.contains("is-lit")).length,
      n: document.querySelectorAll("[data-ing]").length,
      stops: document.querySelectorAll(".nd-drip > i[aria-hidden]").length,
      scene: document.querySelector("[data-st]").getBoundingClientRect().top < 0,
    }));
  let s = await read();
  console.log(`start y${s.y} lit ${s.lit}/${s.n} stops ${s.stops}`);
  for (let k = 0; k < 14; k++) {
    for (let j = 0; j < BURST; j++) {
      await p.mouse.wheel(0, 100);
      await p.waitForTimeout(25);
    }
    await p.waitForTimeout(900);
    const t = await read();
    console.log(`burst ${k + 1}: y${s.y}->${t.y} lit ${s.lit}->${t.lit}${t.scene ? " SCENE" : ""}`);
    s = t;
    if (t.scene && t.y > 0) {
      const u = await read();
      if (u.scene && k > 3) break;
    }
  }
} finally {
  await b.close();
}
