// Ad hoc: the intro loader frozen at points of its count (a fresh visitor, so it plays), desktop and phone, on one sheet.
import { chromium } from "playwright-core";
const OUT = process.env.OUT;
const URL = process.env.URL ?? "http://localhost:3001/drips";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const shots = [];
  for (const [W, H] of [
    [1440, 900],
    [390, 844],
  ]) {
    for (const at of [200, 520, 790]) {
      const ctx = await b.newContext({ viewport: { width: W, height: H } });
      const p = await ctx.newPage();
      // Freeze the count, the bag and the wordmark at `at` ms of their 800.
      await p.addInitScript((at) => {
        const s = document.createElement("style");
        s.textContent = `.intro-fluid,.intro-mark,.intro-count{animation-play-state:paused!important;animation-delay:-${at}ms!important}`;
        document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s));
      }, at);
      await p.goto(URL, { waitUntil: "load", timeout: 240000 });
      await p.waitForTimeout(900);
      const on = await p.evaluate(() => document.documentElement.className);
      shots.push({
        label: `${W}x${H} at ${at}ms (${/intro-pending/.test(on) ? "intro on" : "intro NOT on: " + on})`,
        png: (await p.screenshot()).toString("base64"),
        W,
      });
      await ctx.close();
    }
  }
  const q = await (await b.newContext({ viewport: { width: 1900, height: 1000 } })).newPage();
  await q.setContent(
    `<body style="margin:0;background:#222;display:flex;flex-wrap:wrap;gap:6px;color:#eee;font:12px sans-serif">${shots
      .map(
        (s) =>
          `<figure style="margin:0"><img src="data:image/png;base64,${s.png}" style="height:${s.W < 900 ? 420 : 300}px;display:block">${s.label}</figure>`
      )
      .join("")}</body>`
  );
  await q.waitForTimeout(400);
  await q.screenshot({ path: OUT, fullPage: true });
} finally {
  await b.close();
}
