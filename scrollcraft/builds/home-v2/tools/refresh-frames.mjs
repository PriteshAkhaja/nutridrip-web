// Ad hoc: screenshots of the bag column every STEP ms after a load, and which of them differ from the one before.
import { chromium } from "playwright-core";
import fs from "fs";
const SLUG = process.env.SLUG ?? "myers-revive";
const W = Number(process.env.W ?? 1920);
const H = Number(process.env.H ?? 920);
const STEP = Number(process.env.STEP ?? 120);
const N = Number(process.env.N ?? 30);
const OUT = process.env.OUT;
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const ctx = await b.newContext({ viewport: { width: W, height: H } });
  const p = await ctx.newPage();
  // Warm the dev server's compile, then measure a fresh load.
  await p.goto(`http://localhost:3001/drips/${SLUG}`, { waitUntil: "networkidle", timeout: 240000 });
  await p.addStyleTag({ content: "*{animation-play-state:paused!important}" }).catch(() => {});
  const p2 = await ctx.newPage();
  // Freeze the float so only real changes show.
  await p2.addInitScript(() => {
    const s = document.createElement("style");
    s.textContent = ".vial__glass{animation:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(s));
  });
  p2.goto(`http://localhost:3001/drips/${SLUG}`, { timeout: 240000 }).catch(() => {});
  // The bag column: the left half on a desktop, the whole width on a phone.
  const clip = { x: 0, y: 64, width: W < 900 || process.env.FULL ? W : Math.round(W / 2), height: H - 64 };
  let prev = null;
  const t0 = Date.now();
  for (let k = 0; k < N; k++) {
    await p2.waitForTimeout(STEP);
    let buf;
    try {
      buf = await p2.screenshot({ clip });
    } catch {
      continue;
    }
    const fonts = await p2
      .evaluate(() => document.fonts?.status + " js:" + document.querySelector(".sc-site")?.classList.contains("nd-js"))
      .catch(() => "?");
    const same = prev && Buffer.compare(prev, buf) === 0;
    if (!same) fs.writeFileSync(`${OUT}/f${String(k).padStart(2, "0")}.png`, buf);
    console.log(`${Date.now() - t0}ms ${same ? "same" : "CHANGED"} ${fonts}`);
    prev = buf;
  }
} finally {
  await b.close();
}
