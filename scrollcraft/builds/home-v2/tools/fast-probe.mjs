// Ad hoc: scroll fast into the stand scene, then report how many shelf bottles are still showing.
import { chromium } from "playwright-core";
const SLUG = process.env.SLUG ?? "myers-revive";
const W = Number(process.env.W ?? 1920);
const H = Number(process.env.H ?? 920);
const GAP = Number(process.env.GAP ?? 60);
const OUT = process.env.OUT;
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const p = await (await b.newContext({ viewport: { width: W, height: H } })).newPage();
  await p.goto(`http://localhost:3001/drips/${SLUG}`, { waitUntil: "networkidle", timeout: 240000 });
  await p.waitForTimeout(1500);
  await p.mouse.move(W / 2, H / 2);
  const state = () =>
    p.evaluate(() => {
      const st = document.querySelector("[data-st]").getBoundingClientRect().top;
      const showing = [...document.querySelectorAll("[data-rb]")].filter(
        (el) => Number(getComputedStyle(el).opacity) > 0.05
      );
      const moving = showing.filter(
        (el) => el.style.transform && !/translate3d\(0(\.0)?px, ?0(\.0)?px/.test(el.style.transform)
      );
      return { y: Math.round(scrollY), scene: st < 0, showing: showing.length, inFlight: moving.length };
    });
  for (let k = 0; k < 40; k++) {
    await p.mouse.wheel(0, 100);
    await p.waitForTimeout(GAP);
    const s = await state();
    if (s.scene) {
      console.log(`scene at notch ${k}:`, JSON.stringify(s));
      for (const ms of [100, 200, 400]) {
        await p.waitForTimeout(ms === 100 ? 100 : ms - (ms === 200 ? 100 : 200));
        console.log(`  +${ms}ms`, JSON.stringify(await state()));
      }
      if (OUT) await p.screenshot({ path: OUT });
      break;
    }
  }
} finally {
  await b.close();
}
