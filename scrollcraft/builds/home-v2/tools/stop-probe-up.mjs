// Ad hoc: on the preview, wheel bursts down past the list into the scene, then bursts back up: rows read after each.
import { chromium } from "playwright-core";
const URL = process.env.URL ?? "http://localhost:3001/drips/myers-revive/preview";
const W = Number(process.env.W ?? 1440);
const H = Number(process.env.H ?? 900);
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
      snap: document.documentElement.style.scrollSnapType || "none",
    }));
  // Down well into the scene, slowly enough for every bottle.
  for (let k = 0; k < 16; k++) {
    await p.mouse.wheel(0, 100);
    await p.waitForTimeout(1700);
  }
  let s = await read();
  console.log(`down: y${s.y} lit ${s.lit} snap ${s.snap}`);
  for (let k = 0; k < 14; k++) {
    for (let j = 0; j < 6; j++) {
      await p.mouse.wheel(0, -100);
      await p.waitForTimeout(25);
    }
    await p.waitForTimeout(900);
    const t = await read();
    console.log(`up burst ${k + 1}: y${s.y}->${t.y} lit ${s.lit}->${t.lit} snap ${t.snap}`);
    s = t;
    if (t.y === 0) break;
  }
} finally {
  await b.close();
}
