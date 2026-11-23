// Ad hoc: each character's advance in a bottle label's band (Outfit 800, its letter-spacing) at 100 px, for glass.ts BAND_W.
import { chromium } from "playwright-core";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const p = await (await b.newContext({ viewport: { width: 1920, height: 920 } })).newPage();
  await p.goto("http://localhost:3001/drips/myers-revive", { waitUntil: "networkidle", timeout: 240000 });
  await p.evaluate(() => document.fonts.ready);
  const chars = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789()-.,/+%&'’:";
  const w = await p.evaluate((chars) => {
    // Unscaled: the band's own font on a bare element (the label itself is scaled down).
    const ref = getComputedStyle(document.querySelector(".vlabel__band b"));
    const el = document.createElement("span");
    el.style.cssText = `position:absolute;left:0;top:0;white-space:pre;font-family:${ref.fontFamily};font-weight:800;font-size:100px;letter-spacing:-0.012em`;
    document.body.appendChild(el);
    const out = {};
    for (const c of chars) {
      el.textContent = c.repeat(20);
      out[c] = Math.round((el.getBoundingClientRect().width / 20) * 10) / 10;
    }
    out.family = ref.fontFamily;
    out.check = {};
    for (const s of ["ASCORBIC ACID", "B-COMPLEX", "MAGNESIUM SULPHATE", "CYANOCOBALAMIN", "(B12)"]) {
      el.textContent = s;
      out.check[s] = Math.round(el.getBoundingClientRect().width * 10) / 10;
    }
    el.remove();
    return out;
  }, chars);
  console.log(JSON.stringify(w));
} finally {
  await b.close();
}
