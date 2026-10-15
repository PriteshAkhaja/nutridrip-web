// The public site, as a visitor sees it: every page and every drip, desktop and phone: it loads,
// every photograph on it loads (none broken, none refused), nothing throws, and no image warning.
import { chromium, request } from "playwright-core";

const BASE = process.env.BASE ?? "http://localhost:3001";
const results = [];
const check = (n, p, d = "") => {
  results.push(p);
  console.log(`${p ? "PASS" : "FAIL"}  ${n}${d ? "  — " + d : ""}`);
};

const anon = await request.newContext({ baseURL: BASE });
const home = await (await anon.get("/drips")).text();
const slugs = [...new Set([...home.matchAll(/href="\/drips\/([a-z0-9-]+)"/g)].map((m) => m[1]))];
const paths = [
  "/",
  "/how-it-works",
  "/drips",
  "/pricing",
  "/safety",
  "/zones",
  "/for-clinics",
  "/about",
  "/faqs",
  ...slugs.map((s) => "/drips/" + s),
];
await anon.dispose();

const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  for (const [label, w, h] of [
    ["desktop", 1440, 900],
    ["phone", 390, 844],
  ]) {
    const c = await b.newContext({ viewport: { width: w, height: h } });
    await c.addInitScript(() => {
      try {
        localStorage.setItem("nd_intro_at", String(Date.now()));
      } catch {}
    });
    const p = await c.newPage();
    const failed = [];
    const errors = [];
    const warns = [];
    p.on("response", (r) => {
      if (r.status() >= 400 && /_next\/image|\/media\/|\/images\//.test(r.url()))
        failed.push(r.status() + " " + r.url().slice(0, 100));
    });
    p.on("pageerror", (e) => errors.push(String(e).slice(0, 120)));
    p.on("console", (m) => {
      if (/Largest Contentful Paint/.test(m.text())) warns.push(m.text().split("\n")[0].slice(0, 100));
    });
    let photos = 0;
    let broken = 0;
    for (const path of paths) {
      const res = await p.goto(BASE + path, { waitUntil: "networkidle", timeout: 240000 });
      const H = await p.evaluate(() => document.documentElement.scrollHeight);
      for (let y2 = 0; y2 < H; y2 += 600) {
        await p.evaluate((v) => scrollTo(0, v), y2);
        await p.waitForTimeout(60);
      }
      await p.waitForTimeout(500);
      const stat = await p.evaluate(() => {
        const imgs = [...document.querySelectorAll("main img")].filter((i) => i.getBoundingClientRect().width > 40);
        // Broken: it failed to load, or it is on screen and has not loaded. A lazy photo far off to the side
        // of a swipeable row has simply not been swiped to yet.
        const onScreen = (i) => {
          const r = i.getBoundingClientRect();
          return r.left < innerWidth && r.right > 0;
        };
        const bad = imgs.filter(
          (i) =>
            (i.complete && i.naturalWidth === 0 && i.currentSrc) || (onScreen(i) && !(i.complete && i.naturalWidth > 0))
        );
        return { n: imgs.length, bad: bad.map((i) => i.currentSrc.slice(-60)) };
      });
      photos += stat.n;
      broken += stat.bad.length;
      if (res.status() !== 200 || stat.bad.length)
        console.log(`  ${label} ${path}: ${res.status()}, broken: ${stat.bad.join(", ")}`);
    }
    check(
      `${label}: ${paths.length} pages load, ${photos} photos shown, none broken`,
      broken === 0,
      `${broken} broken`
    );
    check(`${label}: no image request failed`, failed.length === 0, failed.slice(0, 2).join(" | "));
    check(`${label}: no page errors`, errors.length === 0, errors.slice(0, 2).join(" | "));
    check(`${label}: no image-loading warning`, warns.length === 0, warns[0] ?? "");
    await c.close();
  }
} finally {
  await b.close();
}
console.log(`${String.fromCharCode(10)}${results.filter(Boolean).length}/${results.length} passed`);
