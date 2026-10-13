// The product in other brand colours, without touching the database: the
// stylesheet the server would inject (lib/theme brandCss) is added to each page.
import fs from "node:fs";
import sharp from "sharp";
import { chromium } from "playwright-core";
const themes = JSON.parse(fs.readFileSync("lab/themes.json", "utf8"));
const PAGES = [
  ["/", 0],
  ["/", 0.62],
  ["/drips/myers-revive", 0.18],
  ["/safety", 0.42],
  ["/pricing", 0],
  ["/quiz", 0],
  ["/login", 0],
];
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  for (const [name, css] of Object.entries({ default: "", ...themes })) {
    const c = await b.newContext({ viewport: { width: 1440, height: 900 } });
    await c.addInitScript((css) => {
      try {
        localStorage.setItem("nd_intro_at", String(Date.now()));
      } catch {}
      if (css)
        document.addEventListener("DOMContentLoaded", () => {
          const s = document.createElement("style");
          s.textContent = css;
          document.head.appendChild(s);
        });
    }, css);
    const p = await c.newPage();
    const shots = [];
    for (const [path, frac] of PAGES) {
      await p.goto("http://localhost:3000" + path, { waitUntil: "networkidle", timeout: 120000 });
      await p.evaluate((f) => {
        const act = document.querySelector("section[aria-labelledby='home-title'], #assembly");
        if (act && f) {
          const r = act.getBoundingClientRect();
          scrollTo({ top: scrollY + r.top + f * (r.height - innerHeight), behavior: "instant" });
        } else scrollTo({ top: document.documentElement.scrollHeight * f, behavior: "instant" });
      }, frac);
      await p.waitForTimeout(1500);
      shots.push(
        await sharp(await p.screenshot())
          .resize(480, 300)
          .png()
          .toBuffer()
      );
    }
    await sharp({ create: { width: 4 * 486, height: 2 * 306, channels: 3, background: "#ddd" } })
      .composite(shots.map((s, i) => ({ input: s, left: (i % 4) * 486, top: Math.floor(i / 4) * 306 })))
      .png()
      .toFile(`lab/theme-${name}.png`);
    console.log("lab/theme-" + name + ".png");
    await c.close();
  }
} finally {
  await b.close();
}
