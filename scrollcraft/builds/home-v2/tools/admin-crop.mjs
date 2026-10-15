// A close crop of an admin card photo at a laptop's 1.25 pixel ratio, and its file size.
import { chromium } from "playwright-core";
const BASE = process.env.BASE ?? "http://localhost:3001";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const c = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.25 });
  const p = await c.newPage();
  const sizes = [];
  p.on("response", async (r) => {
    if (r.url().includes("/_next/image") && r.url().includes("drip-bag"))
      sizes.push(Math.round((await r.body()).length / 1024) + " KB " + r.url().replace(/.*(w=\d+&q=\d+)/, "$1"));
  });
  await p.request.post(BASE + "/api/auth/login", { data: { email: "admin@nutridrip.com", password: "admin123" } });
  await p.goto(BASE + "/admin/images#page-pricing", { waitUntil: "networkidle", timeout: 240000 });
  await p.waitForTimeout(1200);
  await p.locator('[id="pricing.closing"] img').screenshot({ path: "lab/media/admin-crop.png" });
  console.log(sizes.join(" | "));
} finally {
  await b.close();
}
