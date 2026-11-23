// Ad hoc: each shelf label's scale on the server's first paint (no script) and after the script runs.
import { chromium } from "playwright-core";
const SLUG = process.env.SLUG ?? "myers-revive";
const W = Number(process.env.W ?? 1920);
const H = Number(process.env.H ?? 920);
const OUT = process.env.OUT;
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const read = (p) =>
  p.evaluate(() =>
    [...document.querySelectorAll(".dp__rb .vlabel")].map((l) => {
      const m = getComputedStyle(l).transform.match(/matrix\(([-\d.e]+)/);
      const nfs = getComputedStyle(l.querySelector(".vlabel__band")).getPropertyValue("--nfs").trim();
      return `${m ? Number(m[1]).toFixed(4) : "none"} band ${nfs}`;
    })
  );
try {
  const url = `http://localhost:3001/drips/${SLUG}`;
  const off = await (await b.newContext({ viewport: { width: W, height: H }, javaScriptEnabled: false })).newPage();
  await off.goto(url, { waitUntil: "load", timeout: 240000 });
  await off.waitForTimeout(800);
  const a = await read(off);
  if (OUT) await off.screenshot({ path: `${OUT}-nojs.png`, clip: { x: 0, y: 0, width: W / 2, height: H } });
  const on = await (await b.newContext({ viewport: { width: W, height: H } })).newPage();
  await on.goto(url, { waitUntil: "networkidle", timeout: 240000 });
  await on.waitForTimeout(1500);
  const c = await read(on);
  if (OUT) await on.screenshot({ path: `${OUT}-js.png`, clip: { x: 0, y: 0, width: W / 2, height: H } });
  console.log(`${SLUG} ${W}x${H}`);
  a.forEach((v, i) => console.log(`  label ${i}: first paint ${v}  scripted ${c[i]}`));
} finally {
  await b.close();
}
