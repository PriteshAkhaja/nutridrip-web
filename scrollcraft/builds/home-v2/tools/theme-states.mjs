// The states a page load does not show: the Drips mega-menu open, the phone
// menu open, an FAQ answer open, buttons and cards hovered, focus rings; and
// the two generated icons. Same custom theme, same scan for the shipped teal.
import fs from "node:fs";
import sharp from "sharp";
import { chromium } from "playwright-core";
const BASE = process.env.BASE ?? "http://localhost:3001";
const CSS = fs.readFileSync("lab/theme-full.css", "utf8");
const OLD = [
  "#0a7fa1",
  "#086780",
  "#e4f6fc",
  "#b3e6f3",
  "#7ee3f8",
  "#06596f",
  "#062530",
  "#0b3340",
  "#1d4653",
  "#f0f7f9",
  "#04181f",
  "#061218",
].map((h) => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
});
const scan = (p) =>
  p.evaluate((OLD) => {
    const near = (s) =>
      [...s.matchAll(/rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\)/g)].some(
        (x) =>
          (x[4] === undefined || +x[4] > 0.05) &&
          OLD.some((o) => Math.abs(o[0] - x[1]) <= 2 && Math.abs(o[1] - x[2]) <= 2 && Math.abs(o[2] - x[3]) <= 2)
      );
    const hits = [];
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      for (const k of [
        "color",
        "backgroundColor",
        "borderTopColor",
        "borderBottomColor",
        "outlineColor",
        "fill",
        "stroke",
        "boxShadow",
        "backgroundImage",
      ]) {
        if (k.startsWith("border") && parseFloat(cs[k.replace("Color", "Width")]) === 0) continue;
        if (k === "outlineColor" && cs.outlineStyle === "none") continue;
        if (near(cs[k] ?? "")) {
          hits.push(el.tagName.toLowerCase() + "." + (el.getAttribute("class") || "").slice(0, 60) + " [" + k + "]");
          break;
        }
      }
    }
    return hits;
  }, OLD);
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const shots = [];
const out = (name, hits) =>
  console.log(`${name.padEnd(34)} ${hits.length ? "LEFTOVER: " + hits.slice(0, 3).join(" | ") : "ok"}`);
try {
  const mk = async (w, h) => {
    const c = await b.newContext({ viewport: { width: w, height: h } });
    await c.addInitScript((css) => {
      try {
        localStorage.setItem("nd_intro_at", String(Date.now()));
      } catch {}
      document.addEventListener("DOMContentLoaded", () => {
        const s = document.createElement("style");
        s.textContent = css;
        document.head.appendChild(s);
      });
    }, CSS);
    return c;
  };
  // Desktop: mega-menu, hovers, focus.
  let c = await mk(1440, 900),
    p = await c.newPage();
  await p.goto(BASE + "/", { waitUntil: "networkidle", timeout: 180000 });
  const trigger = p.locator('button[aria-label="Drips by goal"]');
  await trigger.click();
  await p.waitForTimeout(900);
  console.log("menu expanded:", await trigger.getAttribute("aria-expanded"));
  out("mega-menu open (desktop)", await scan(p));
  shots.push(await p.screenshot({ clip: { x: 0, y: 0, width: 1440, height: 560 } }));
  await p.keyboard.press("Escape");
  await p.mouse.move(5, 600);
  await p.goto(BASE + "/drips", { waitUntil: "networkidle" });
  const card = p.locator("main a[href^='/drips/']:visible").nth(1);
  await card.scrollIntoViewIfNeeded();
  await card.hover();
  await p.waitForTimeout(800);
  out("drip card hovered", await scan(p));
  shots.push(await p.screenshot());
  const sec = p.locator("main .btn-secondary:visible").first();
  await sec.scrollIntoViewIfNeeded();
  await sec.hover();
  await p.waitForTimeout(900);
  out("secondary button hovered", await scan(p));
  await p.keyboard.press("Tab");
  await p.keyboard.press("Tab");
  await p.keyboard.press("Tab");
  await p.waitForTimeout(300);
  out("focus ring (keyboard)", await scan(p));
  await p.goto(BASE + "/faqs", { waitUntil: "networkidle" });
  await p.locator("details summary").first().click();
  await p.waitForTimeout(600);
  out("FAQ answer open", await scan(p));
  shots.push(await p.screenshot());
  await c.close();
  // Phone: the menu.
  c = await mk(390, 844);
  p = await c.newPage();
  await p.goto(BASE + "/", { waitUntil: "networkidle" });
  await p.locator("header button[aria-expanded]").last().click();
  await p.waitForTimeout(800);
  out("phone menu open", await scan(p));
  shots.push(await p.screenshot());
  // The icons.
  for (const [name, path] of [
    ["tab icon", "/brand-mark.svg"],
    ["home-screen icon", "/apple-icon"],
  ]) {
    const r = await p.request.get(BASE + path);
    console.log(`${name.padEnd(34)} ${r.status()} ${r.headers()["content-type"]}`);
  }
  await c.close();
  const tiles = await Promise.all(
    shots.map((s) => sharp(s).resize({ height: 300 }).png().toBuffer({ resolveWithObject: true }))
  );
  let x = 0;
  const comp = tiles.map((t) => {
    const r = { input: t.data, left: x, top: 0 };
    x += t.info.width + 6;
    return r;
  });
  await sharp({ create: { width: x, height: 300, channels: 3, background: "#ccc" } })
    .composite(comp)
    .png()
    .toFile("lab/full/states.png");
} finally {
  await b.close();
}
