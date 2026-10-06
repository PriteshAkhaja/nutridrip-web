// Screenshot each <section class="frame"> of a page, once fonts and images
// have loaded. The browser is closed when it is done.
//
//   node tools/frames.mjs http://localhost:4610/lab/compare/ lab/compare/shots
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright-core";

const [url, outDir = "lab/shots", scale = "1"] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--disable-features=PointerLock"],
});
try {
  const page = await browser.newPage({ viewport: { width: 1640, height: 1100 }, deviceScaleFactor: Number(scale) });
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("requestfailed", (r) => errors.push(`failed ${r.url()}`));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.body.dataset.ready === "1", null, { timeout: 15000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images].map((i) =>
        i.complete
          ? null
          : new Promise((r) => {
              i.onload = i.onerror = r;
            })
      )
    );
  });
  for (const el of await page.$$("section.frame")) {
    const id = await el.getAttribute("id");
    const file = path.join(outDir, `${id}.png`);
    await el.screenshot({ path: file });
    console.log(file);
  }
  if (errors.length) console.log("errors:", errors);
} finally {
  await browser.close();
}
