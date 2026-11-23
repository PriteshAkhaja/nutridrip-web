// Ad hoc: on a phone, how far the shelf's top row sits below the header, at rest and lifted by its cue.
import { chromium } from "playwright-core";
const SLUG = process.env.SLUG ?? "myers-revive";
const W = Number(process.env.W ?? 390);
const H = Number(process.env.H ?? 844);
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const p = await (await b.newContext({ viewport: { width: W, height: H } })).newPage();
  await p.goto(`http://localhost:3001/drips/${SLUG}`, { waitUntil: "networkidle", timeout: 240000 });
  await p.addStyleTag({ content: ".vial__glass{animation:none!important}" });
  await p.waitForTimeout(800);
  for (const before of [0.3, 0.06, 0.0]) {
    await p.evaluate((f) => {
      const r = document.querySelectorAll("[data-ing]")[1].getBoundingClientRect();
      scrollTo(0, r.top + scrollY - innerHeight * (0.62 + f));
    }, before);
    await p.waitForTimeout(900);
    const m = await p.evaluate(() => {
      const bar = document.querySelector(".nd-bar")?.getBoundingClientRect().bottom ?? 0;
      const first = document.querySelector("[data-rb]");
      const glass = first.querySelector(".vial__glass").getBoundingClientRect();
      const halo = getComputedStyle(first, "::before");
      return {
        bar: Math.round(bar),
        glassTop: Math.round(glass.top),
        cue: first.style.getPropertyValue("--cue"),
        stuck: Math.round(document.querySelector(".dp__bagstick").getBoundingClientRect().top),
        haloInset: halo.top,
      };
    });
    console.log(`row 1 ${before} screen below the line:`, JSON.stringify(m));
  }
} finally {
  await b.close();
}
