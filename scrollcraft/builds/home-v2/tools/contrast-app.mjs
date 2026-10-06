// Contrast of the act's text against what is actually behind it. At the frame
// where each line is read: hide the line, capture the ground under it, take
// the worst pixel (98th percentile toward the text's own lightness), and
// compute WCAG contrast with the text's colour.
import sharp from "sharp";
import { chromium } from "playwright-core";
const [W = "1440", H = "900"] = process.argv.slice(2);
const CHECKS = [
  { p: 0, sel: "[data-asm-hero] h1", name: "hero headline" },
  { p: 0, sel: "[data-asm-hero] p", name: "hero sub" },
  { p: 0.2, sel: "[data-asm-count]", name: "count title" },
  { p: 0.2, sel: "[data-asm-cap] b", name: "caption name", all: true },
  { p: 0.2, sel: "[data-asm-cap] span", name: "caption dose", all: true },
  { p: 0.66, sel: "[data-asm-one]", name: "One drip." },
  { p: 0.66, sel: "[data-asm-one] span", name: "drip name" },
  { p: 0.72, sel: "[data-asm-readout]", name: "fill readout" },
  { p: 0.84, sel: '[data-asm-card="a"] p', name: "card A" },
  { p: 0.84, sel: '[data-asm-card="b"] p', name: "card B" },
  { p: 1, sel: "[data-asm-grounded] p:first-child", name: "time stamp" },
  { p: 1, sel: "[data-asm-grounded] p:nth-child(2)", name: "closing line" },
  { p: 1, sel: '[data-asm-grounded] a[href="/consult"]', name: "Ask a clinician" },
];
const lum = (r, g, b) => {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const c = await b.newContext({ viewport: { width: +W, height: +H } });
  await c.addInitScript(() => {
    try {
      localStorage.setItem("nd_intro_at", String(Date.now()));
    } catch {}
  });
  const pg = await c.newPage();
  await pg.goto((process.env.BASE ?? "http://localhost:3000") + "/", { waitUntil: "networkidle", timeout: 120000 });
  await pg.waitForTimeout(1200);
  let lastP = -1;
  for (const ck of CHECKS) {
    if (ck.p !== lastP) {
      await pg.evaluate((p) => {
        const a = document.querySelector("section[aria-labelledby='home-title']");
        const r = a.getBoundingClientRect();
        scrollTo({ top: Math.round(scrollY + r.top + p * (r.height - innerHeight)), behavior: "instant" });
      }, ck.p);
      await pg.waitForTimeout(1400);
      lastP = ck.p;
    }
    const els = await pg.$$(`section[aria-labelledby='home-title'] ${ck.sel}`);
    let worst = null;
    for (const el of ck.all ? els : els.slice(0, 1)) {
      const info = await el.evaluate((n) => {
        const r = n.getBoundingClientRect();
        let op = 1;
        for (let x = n; x && x !== document.body; x = x.parentElement) op *= +getComputedStyle(x).opacity;
        const col = getComputedStyle(n)
          .color.match(/[\d.]+/g)
          .map(Number);
        return { x: r.left, y: r.top, w: r.width, h: r.height, op, col };
      });
      if (info.op < 0.9 || info.w < 2 || info.y < 0 || info.y + info.h > +H) continue;
      await el.evaluate((n) => (n.style.visibility = "hidden"));
      const buf = await pg.screenshot({
        clip: { x: Math.max(0, info.x), y: Math.max(0, info.y), width: Math.min(info.w, +W - info.x), height: info.h },
      });
      await el.evaluate((n) => (n.style.visibility = ""));
      const { data, info: im } = await sharp(buf).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      const Ls = [];
      for (let i = 0; i < im.width * im.height; i++) Ls.push(lum(data[i * 3], data[i * 3 + 1], data[i * 3 + 2]));
      Ls.sort((a, b) => a - b);
      const [r, g, bl, alpha = 1] = info.col;
      const tl = lum(r, g, bl);
      // Light text: its worst ground is the brightest; dark text: the darkest.
      const ground = tl > 0.5 ? Ls[Math.floor(Ls.length * 0.98)] : Ls[Math.floor(Ls.length * 0.02)];
      const cr = ratio(tl, ground) * (alpha < 1 ? alpha : 1);
      if (!worst || cr < worst.cr) worst = { cr, tl, ground };
    }
    if (!worst) {
      console.log(`${ck.name.padEnd(18)} not measurable at p${ck.p}`);
      continue;
    }
    console.log(`${ck.name.padEnd(18)} p${String(ck.p).padEnd(5)} ${worst.cr.toFixed(2)}:1`);
  }
} finally {
  await b.close();
}
