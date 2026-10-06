// Reload behaviour on the real site: a reload mid-page should start at the top;
// Back after a client navigation should still return to where you were; a
// #hash should still open its section; a console page keeps the browser's own.
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
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  const y = () => p.evaluate(() => Math.round(scrollY));
  for (const path of ["/", "/safety", "/drips/myers-revive"]) {
    await p.goto(BASE + path, { waitUntil: "networkidle", timeout: 120000 });
    await p.evaluate(() => scrollTo({ top: document.documentElement.scrollHeight * 0.5, behavior: "instant" }));
    await p.waitForTimeout(600);
    const before = await y();
    await p.reload({ waitUntil: "networkidle" });
    await p.waitForTimeout(1500);
    console.log(`reload ${path.padEnd(22)} was at ${before}, now at ${await y()}`);
  }
  // Back after a client navigation: /drips, scroll down, open a drip, go back.
  await p.goto(BASE + "/drips", { waitUntil: "networkidle" });
  await p.evaluate(() => scrollTo({ top: 1400, behavior: "instant" }));
  await p.waitForTimeout(600);
  const at = await y();
  await p.locator('a[href^="/drips/"]').nth(4).click();
  await p.waitForURL(/\/drips\/.+/, { timeout: 60000 });
  await p.waitForTimeout(1200);
  await p.goBack();
  await p.waitForURL(BASE + "/drips", { timeout: 60000 });
  await p.waitForTimeout(1500);
  console.log(`back to /drips          was at ${at}, now at ${await y()}`);
  // Back after a reload, the other way round: reload a page, navigate, come back.
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  await p.evaluate(() => scrollTo({ top: 1400, behavior: "instant" }));
  await p.waitForTimeout(1300);
  const at2 = await y();
  await p.locator('a[href^="/drips/"]').nth(4).click();
  await p.waitForURL(/\/drips\/.+/, { timeout: 60000 });
  await p.waitForTimeout(1200);
  await p.goBack();
  await p.waitForURL(BASE + "/drips", { timeout: 60000 });
  await p.waitForTimeout(1500);
  console.log(`back after a reload     was at ${at2}, now at ${await y()}`);
  // A #hash still opens its section on reload.
  await p.goto(BASE + "/for-clinics#enquire", { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  await p.reload({ waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  const hash = await p.evaluate(() =>
    Math.round(document.getElementById("enquire")?.getBoundingClientRect().top ?? -1)
  );
  console.log(`reload /for-clinics#enquire: section top at ${hash}px in the viewport, scrollY ${await y()}`);
  // Back into a fresh page load (full navigation away, then Back).
  await p.goto(BASE + "/safety", { waitUntil: "networkidle" });
  await p.evaluate(() => scrollTo({ top: 1800, behavior: "instant" }));
  await p.waitForTimeout(600);
  await p.goto(BASE + "/pricing", { waitUntil: "networkidle" });
  await p.goBack({ waitUntil: "networkidle" });
  await p.waitForTimeout(1800);
  console.log(`full Back to /safety    was at 1800, now at ${await y()}`);
  console.log("errors:", errors.length ? errors : "none");
} finally {
  await b.close();
}
