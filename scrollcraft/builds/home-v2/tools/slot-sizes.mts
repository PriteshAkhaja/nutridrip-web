// How big each replaceable place really draws its photo, on its own page, at 1440 and 390 wide.
import { chromium } from "playwright-core";
import { PAGES, SLOTS, type SlotKey } from "../../../../src/lib/media/slots";
import { SITE_IMAGES } from "../../../../src/lib/site-images";
const BASE = process.env.BASE ?? "http://localhost:3001";
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const rows: string[] = [];
try {
  const seen = new Map<string, { path: string; file: string; keys: SlotKey[] }>();
  for (const k of Object.keys(SLOTS) as SlotKey[]) {
    const page = PAGES.find((p) => p.key === SLOTS[k].page)!;
    const file = SITE_IMAGES[SLOTS[k].fallback].src.replace(/.*\//, "");
    seen.set(k, { path: page.path, file, keys: [k] });
  }
  const sizes = new Map<string, string>();
  for (const [w, h] of [
    [1440, 900],
    [390, 844],
  ]) {
    const c = await b.newContext({ viewport: { width: w, height: h } });
    await c.addInitScript(() => {
      try {
        localStorage.setItem("nd_intro_at", String(Date.now()));
      } catch {}
    });
    const p = await c.newPage();
    const byPath = new Map<string, Array<{ file: string; w: number; h: number }>>();
    for (const path of new Set([...seen.values()].map((s) => s.path))) {
      await p.goto(BASE + path, { waitUntil: "networkidle", timeout: 240000 });
      const H = await p.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < H; y += 600) {
        await p.evaluate((y) => scrollTo(0, y), y);
        await p.waitForTimeout(80);
      }
      await p.waitForTimeout(600);
      byPath.set(
        path,
        await p.evaluate(() =>
          [...document.querySelectorAll("main img")].map((i) => {
            const r = i.parentElement!.getBoundingClientRect();
            const f = decodeURIComponent(
              (i as HTMLImageElement).currentSrc.replace(/.*url=/, "").replace(/&.*/, "")
            ).replace(/.*\//, "");
            return { file: f, w: Math.round(r.width), h: Math.round(r.height) };
          })
        )
      );
    }
    for (const [k, s] of seen) {
      const hits = (byPath.get(s.path) ?? []).filter((x) => x.file === s.file && x.w > 100);
      const key = k;
      const best = hits.sort((a, b) => b.w * b.h - a.w * a.h)[0];
      sizes.set(key + "@" + w, best ? `${best.w}×${best.h}` : "-");
    }
    await c.close();
  }
  for (const [k] of seen)
    rows.push(`${k.padEnd(34)} desktop ${(sizes.get(k + "@1440") ?? "").padEnd(10)} phone ${sizes.get(k + "@390")}`);
} finally {
  await b.close();
}
console.log(rows.join("\n"));
