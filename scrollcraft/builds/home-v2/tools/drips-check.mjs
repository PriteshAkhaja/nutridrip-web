// The assembly act on every drip page at the moments that matter, one sheet per
// drip, plus a geometry report: does the ring cross a "given separately"
// container, do callout cards overlap it, does anything leave the screen.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { chromium } from "playwright-core";
const BASE = process.env.BASE ?? "http://localhost:3000";
const [W = "1440", H = "900", out = "lab/drips"] = process.argv.slice(2);
const P = [0.12, 0.33, 0.44, 0.57, 0.66, 0.74, 0.84, 1];
const slugs = JSON.parse(fs.readFileSync("data/drips.json", "utf8")).map((d) => d.slug);
fs.mkdirSync(out, { recursive: true });
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const c = await b.newContext({ viewport: { width: +W, height: +H } });
  await c.addInitScript(() => {
    try {
      localStorage.setItem("nd_intro_at", String(Date.now()));
    } catch {}
  });
  const p = await c.newPage();
  const errors = [];
  p.on("pageerror", (e) => errors.push(String(e)));
  for (const slug of slugs) {
    await p.goto(`${BASE}/drips/${slug}`, { waitUntil: "networkidle", timeout: 120000 });
    await p.waitForTimeout(800);
    const tiles = [],
      notes = [];
    for (const t of P) {
      await p.evaluate((t) => {
        const a = document.getElementById("assembly");
        const r = a.getBoundingClientRect();
        scrollTo({ top: Math.round(scrollY + r.top + t * (r.height - innerHeight)), behavior: "instant" });
      }, t);
      await p.waitForTimeout(1200);
      const g = await p.evaluate(() => {
        const a = document.getElementById("assembly");
        const vis = (el) => el && +getComputedStyle(el).opacity > 0.15 && getComputedStyle(el).visibility !== "hidden";
        const box = (el) => {
          const r = el.getBoundingClientRect();
          return { l: r.left, t: r.top, r: r.right, b: r.bottom };
        };
        const ring = a.querySelector("[data-asm-ring]");
        const rr = ring && vis(ring) ? ring.getBoundingClientRect() : null;
        const ringC = rr && { x: (rr.left + rr.right) / 2, y: (rr.top + rr.bottom) / 2, R: rr.width / 2 };
        const seps = [...a.querySelectorAll(".ctr")].filter((e) => vis(e));
        const caps = [...a.querySelectorAll("[data-asm-cap]")].filter((e) => vis(e) && e.querySelector("em"));
        const cards = [...a.querySelectorAll("[data-asm-card]")].filter((e) => vis(e)).map(box);
        const hits = [];
        for (const el of [...seps, ...caps]) {
          const x = box(el);
          if (ringC) {
            // Does the ring's circle pass through this box?
            const nx = Math.max(x.l, Math.min(ringC.x, x.r)),
              ny = Math.max(x.t, Math.min(ringC.y, x.b));
            const near = Math.hypot(nx - ringC.x, ny - ringC.y);
            const far = Math.max(
              ...[
                [x.l, x.t],
                [x.r, x.t],
                [x.l, x.b],
                [x.r, x.b],
              ].map(([px, py]) => Math.hypot(px - ringC.x, py - ringC.y))
            );
            if (near < ringC.R && far > ringC.R)
              hits.push("ring crosses " + (el.matches(".ctr") ? "container" : "caption"));
          }
          for (const cb of cards)
            if (x.l < cb.r && x.r > cb.l && x.t < cb.b && x.b > cb.t)
              hits.push("card overlaps " + (el.matches(".ctr") ? "container" : "caption"));
          if (x.r > innerWidth || x.l < 0 || x.b > innerHeight) hits.push("off screen");
        }
        return [...new Set(hits)];
      });
      if (g.length) notes.push(`p${t}: ${g.join(", ")}`);
      tiles.push(await p.screenshot({ type: "png" }));
    }
    const tw = 480,
      th = Math.round((tw * +H) / +W);
    const small = await Promise.all(tiles.map((t) => sharp(t).resize(tw, th).png().toBuffer()));
    await sharp({ create: { width: 4 * (tw + 6), height: 2 * (th + 6), channels: 3, background: "#ddd" } })
      .composite(small.map((s, i) => ({ input: s, left: (i % 4) * (tw + 6), top: Math.floor(i / 4) * (th + 6) })))
      .png()
      .toFile(path.join(out, `${slug}-${W}.png`));
    console.log(`${slug.padEnd(20)} ${notes.length ? notes.join(" | ") : "ok"}`);
  }
  console.log("errors:", errors.length ? errors : "none");
} finally {
  await b.close();
}
