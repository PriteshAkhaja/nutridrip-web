import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
await c.addInitScript(() => {
  try {
    localStorage.setItem("nd_intro_at", String(Date.now()));
  } catch {}
});
const p = await c.newPage();
await p.goto("http://localhost:3001/drips/hydrate-plus", { waitUntil: "networkidle", timeout: 240000 });
await p.waitForTimeout(1200);
const info = await p.evaluate(() => {
  const r = document.querySelector("[data-bs]").getBoundingClientRect();
  return { top: r.top + scrollY, h: r.height };
});
for (const s of [0.3, 0.36, 0.41]) {
  await p.evaluate((y) => scrollTo(0, y), info.top + s * (info.h - 900));
  await p.waitForTimeout(600);
  const o = await p.evaluate(() => {
    const cell = document.querySelector('[data-cellkind="sep"]');
    const bot = cell.querySelector(".bs__bottle");
    const bag = document.querySelector("[data-dp-bag]").getBoundingClientRect();
    const slotR = document.querySelector(".bs__bagslot").getBoundingClientRect();
    const bagwR = document.querySelector("[data-bs-bag]").getBoundingClientRect();
    const cellR = document.querySelector('[data-cellkind="sep"]').getBoundingClientRect();
    const r = bot.getBoundingClientRect();
    const pin = document.querySelector(".bs__pin").getBoundingClientRect();
    return {
      slot: [Math.round(slotR.left), Math.round(slotR.top), Math.round(slotR.width), Math.round(slotR.height)],
      bagw: [Math.round(bagwR.left), Math.round(bagwR.width)],
      cell: [Math.round(cellR.left), Math.round(cellR.top), Math.round(cellR.width), Math.round(cellR.height)],
      bottle: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
      bag: [Math.round(bag.left), Math.round(bag.top), Math.round(bag.width), Math.round(bag.height)],
      style: bot.getAttribute("style"),
      op: getComputedStyle(bot).opacity,
      pin: [Math.round(pin.left), Math.round(pin.top)],
    };
  });
  console.log(s, JSON.stringify(o));
}
await b.close();
