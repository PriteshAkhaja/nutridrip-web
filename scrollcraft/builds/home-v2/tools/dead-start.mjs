// From the moment the act locks (its top reaches the top of the screen), how
// far does the reader scroll before the first container moves? And does the
// act still end on the room?
import { chromium } from "playwright-core";
const BASE = process.env.BASE ?? "http://localhost:3000";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
  await c.addInitScript(() => {
    try {
      localStorage.setItem("nd_intro_at", String(Date.now()));
    } catch {}
  });
  const p = await c.newPage();
  for (const path of ["/drips/glow-protocol", "/drips/myers-revive"]) {
    await p.goto(BASE + path, { waitUntil: "networkidle", timeout: 120000 });
    await p.waitForTimeout(800);
    const top = await p.evaluate(() => {
      const a = document.getElementById("assembly");
      return scrollY + a.getBoundingClientRect().top;
    });
    const snap = () =>
      p.evaluate(() => [...document.querySelectorAll("#assembly .ctr")].map((e) => e.style.transform).join("|"));
    await p.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), top);
    await p.waitForTimeout(1200);
    const rest = await snap();
    let moved = null;
    for (let d = 20; d <= 1600; d += 20) {
      await p.evaluate((y) => scrollTo({ top: y, behavior: "instant" }), top + d);
      await p.waitForTimeout(900);
      if ((await snap()) !== rest) {
        moved = d;
        break;
      }
    }
    const h = await p.evaluate(() => document.getElementById("assembly").offsetHeight);
    await p.evaluate(() => {
      const a = document.getElementById("assembly");
      scrollTo({ top: scrollY + a.getBoundingClientRect().bottom - innerHeight, behavior: "instant" });
    });
    await p.waitForTimeout(1500);
    const end = await p.evaluate(() => {
      const r = document.querySelector("#assembly [data-asm-room]");
      return r ? getComputedStyle(r).visibility + " " + r.style.transform : "?";
    });
    console.log(
      `${path.padEnd(22)} act ${h}px (${(h / 900).toFixed(2)} screens); first container moves after ${moved ?? ">1600"}px of scroll (${moved ? (moved / 900).toFixed(2) : "?"} screens); at the end the room is ${end}`
    );
  }
} finally {
  await b.close();
}
