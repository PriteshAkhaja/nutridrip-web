// Frame times while wheel-scrolling through the assembly act, on the GPU
// (this machine's Intel HD 530, not the software renderer).
//   BASE=http://localhost:3100 node tools/frames-app.mjs [width] [height]
import { chromium } from "playwright-core";
const BASE = process.env.BASE ?? "http://localhost:3000";
const [W = "1440", H = "900"] = process.argv.slice(2);
const b = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  args: ["--headless=new", "--ignore-gpu-blocklist", "--enable-gpu", "--use-angle=d3d11"],
});
try {
  const c = await b.newContext({ viewport: { width: +W, height: +H } });
  await c.addInitScript(() => {
    try {
      localStorage.setItem("nd_intro_at", String(Date.now()));
    } catch {}
  });
  const p = await c.newPage();
  await p.goto(BASE + (process.env.PAGE ?? "/"), { waitUntil: "networkidle", timeout: 180000 });
  if (process.env.CSS) await p.addStyleTag({ content: process.env.CSS });
  await p.waitForTimeout(2500);
  const gpu = await p.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    const d = gl?.getExtension("WEBGL_debug_renderer_info");
    return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : "?";
  });
  await p.evaluate(() => {
    window.__f = [];
    let last = performance.now();
    const top = 0,
      tr = 5760 - innerHeight;
    window.__l = [];
    const tick = (t) => {
      const d = t - last;
      window.__f.push(d);
      if (d > 33.4) window.__l.push([Math.round(d), +((scrollY - top) / tr).toFixed(3)]);
      last = t;
      if (window.__run) requestAnimationFrame(tick);
    };
    window.__run = true;
    requestAnimationFrame(tick);
  });
  await p.mouse.move(W / 2, H / 2);
  const end = 5760;
  // Wheel notches of 100 px, about 12 a second: a steady, ordinary scroll.
  for (let y = 0; y < end; y += 100) {
    await p.mouse.wheel(0, 100);
    await p.waitForTimeout(80);
  }
  await p.waitForTimeout(1000);
  const f = await p.evaluate(() => {
    window.__run = false;
    return window.__f.slice(1);
  });
  f.sort((a, b) => a - b);
  const q = (x) => f[Math.min(f.length - 1, Math.floor(f.length * x))];
  const long = f.filter((x) => x > 33.4).length;
  const L = await p.evaluate(() => window.__l);
  console.log("long frames [ms, act p]:", JSON.stringify(L));
  console.log(`${W}x${H} on ${gpu}`);
  console.log(
    `frames ${f.length}  median ${q(0.5).toFixed(1)} ms  p95 ${q(0.95).toFixed(1)} ms  p99 ${q(0.99).toFixed(1)} ms  over 33 ms: ${long} (${((long / f.length) * 100).toFixed(1)}%)`
  );
} finally {
  await b.close();
}
