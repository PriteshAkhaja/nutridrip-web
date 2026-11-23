// Ad hoc: each goal's morning picture, fully in, at several screen sizes, on one contact sheet.
import { chromium } from "playwright-core";
import fs from "fs";
const OUT = process.env.OUT;
const SLUGS = (process.env.SLUGS ?? "myers-revive,hydrate-plus,immune-shield,glow-protocol").split(",");
const SIZES = [
  [1920, 920],
  [2560, 1080],
  [1440, 900],
  [390, 844],
];
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const shots = [];
  for (const slug of SLUGS) {
    for (const [W, H] of SIZES) {
      const p = await (await b.newContext({ viewport: { width: W, height: H } })).newPage();
      await p.goto(`http://localhost:3001/drips/${slug}`, { waitUntil: "networkidle", timeout: 240000 });
      await p.waitForTimeout(800);
      // The morning, its words in: p about 0.97 of the scene's scroll.
      await p.evaluate(() => {
        const st = document.querySelector("[data-st]");
        const top = st.getBoundingClientRect().top + scrollY;
        scrollTo(0, top + 0.97 * (st.offsetHeight - innerHeight));
      });
      await p.waitForTimeout(500);
      await p.mouse.wheel(0, 1);
      await p.waitForTimeout(1200);
      shots.push({ slug, W, H, png: (await p.screenshot()).toString("base64") });
      await p.close();
    }
  }
  const html = `<body style="margin:0;background:#222;font:14px sans-serif;color:#eee">${SLUGS.map(
    (s) =>
      `<div style="display:flex;gap:8px;align-items:flex-start;padding:6px"><div style="width:110px">${s}</div>${shots
        .filter((x) => x.slug === s)
        .map(
          (x) =>
            `<figure style="margin:0"><img src="data:image/png;base64,${x.png}" style="height:220px;display:block"><figcaption>${x.W}x${x.H}</figcaption></figure>`
        )
        .join("")}</div>`
  ).join("")}</body>`;
  const p = await (await b.newContext({ viewport: { width: 1900, height: 1000 } })).newPage();
  await p.setContent(html);
  await p.waitForTimeout(500);
  await p.screenshot({ path: OUT, fullPage: true });
} finally {
  await b.close();
}
