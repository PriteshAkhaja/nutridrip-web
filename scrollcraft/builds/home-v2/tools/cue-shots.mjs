// Ad hoc: the shelf as row ROW comes up to the reading line (its bottle's cue at 0, half, nearly whole).
import { chromium } from "playwright-core";
const SLUG = process.env.SLUG ?? "myers-revive";
const W = Number(process.env.W ?? 1920);
const H = Number(process.env.H ?? 920);
const ROW = Number(process.env.ROW ?? 2);
const OUT = process.env.OUT;
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
try {
  const p = await (await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 })).newPage();
  await p.goto(`http://localhost:3001/drips/${SLUG}`, { waitUntil: "networkidle", timeout: 240000 });
  await p.addStyleTag({ content: ".vial__glass{animation:none!important}" });
  await p.waitForTimeout(800);
  const shots = [];
  for (const before of [0.25, 0.1, 0.01]) {
    // The row's top this far (in screens) below the reading line.
    await p.evaluate(
      ([i, f]) => {
        const r = document.querySelectorAll("[data-ing]")[i].getBoundingClientRect();
        scrollTo(0, r.top + scrollY - innerHeight * (0.62 + f));
      },
      [ROW, before]
    );
    await p.waitForTimeout(2500);
    const clip = await p.evaluate(() => {
      const r = document.querySelector(".dp__rack").getBoundingClientRect();
      return { x: r.left - 30, y: r.top - 30, width: r.width + 60, height: r.height + 60 };
    });
    shots.push({ before, png: (await p.screenshot({ clip })).toString("base64") });
  }
  const q = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  await q.setContent(
    `<body style="margin:0;background:#222;display:flex;gap:6px;color:#eee;font:13px sans-serif">${shots
      .map(
        (s) =>
          `<figure style="margin:0"><img src="data:image/png;base64,${s.png}" style="height:520px;display:block">row ${s.before} screen below the line</figure>`
      )
      .join("")}</body>`
  );
  await q.waitForTimeout(300);
  await q.screenshot({ path: OUT, fullPage: true });
} finally {
  await b.close();
}
