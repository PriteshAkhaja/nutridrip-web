// Drives tools/studio/index.html in headless Chrome on the GPU and saves the
// finished path-traced frame. The browser closes when it is done.
//
//   node tools/studio.mjs out/render-containers.png "subject=containers&w=2400&h=1350&samples=600"
// (needs the build folder served on :4610: serve.mjs --root . --port 4610)
import fs from "node:fs";
import { chromium } from "playwright-core";

const [out, query = "", port = "4610"] = process.argv.slice(2);
const params = new URLSearchParams(query);
const W = Number(params.get("w") ?? 1200),
  H = Number(params.get("h") ?? 675);
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: [
    "--headless=new",
    "--ignore-gpu-blocklist",
    "--enable-gpu",
    "--use-angle=d3d11",
    "--disable-features=PointerLock",
  ],
});
try {
  const page = await browser.newPage({ viewport: { width: W, height: H } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !/404/.test(m.text()) && errors.push(m.text()));
  page.on("response", (r) => r.status() >= 400 && !/favicon/.test(r.url()) && errors.push(`${r.status()} ${r.url()}`));
  const t0 = Date.now();
  await page.goto(`http://localhost:${port}/tools/studio/index.html?${query}`);
  let last = -1;
  for (;;) {
    const s = await page.evaluate(() => ({ n: window.__samples ?? 0, done: !!window.__done }));
    if (errors.length) throw new Error(errors.join("\n"));
    if (s.done) break;
    if (Math.floor(s.n / 50) !== Math.floor(last / 50))
      console.log(`  ${s.n} samples, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    last = s.n;
    await new Promise((r) => setTimeout(r, 1000));
  }
  const url = await page.evaluate(() => document.querySelector("canvas").toDataURL("image/png"));
  fs.writeFileSync(out, Buffer.from(url.split(",")[1], "base64"));
  console.log(`${out}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
} finally {
  await browser.close();
}
