// Ad hoc: a quick wheel scroll down through the list into the stand scene and back up, checked as it goes.
// Per sample: bottles moving (off the shelf, not yet gone), the port ring, blooms showing, label lines printed.
// Writes a contact sheet of the bag and shelf (OUT) and prints anything wrong.
import { chromium } from "playwright-core";
const SLUG = process.env.SLUG ?? "myers-revive";
const W = Number(process.env.W ?? 1920);
const H = Number(process.env.H ?? 920);
const GAP = Number(process.env.GAP ?? 70); // ms between notches
const OUT = process.env.OUT;
const b = await chromium.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe" });
const state = (p) =>
  p.evaluate(async () => {
    // What was painted: after the page's own frame for the latest scroll.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const num = (v) => Number(v || 0);
    const bottles = [...document.querySelectorAll("[data-rb]")];
    const moving = bottles.filter((el) => {
      const op = num(getComputedStyle(el).opacity);
      const m = (el.style.transform || "").match(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px/);
      const off = m && (Math.abs(+m[1]) > 2 || Math.abs(+m[2]) > 12);
      return op > 0.05 && off;
    }).length;
    const gone = bottles.filter((el) => num(getComputedStyle(el).opacity) < 0.05).length;
    const ring = num(document.querySelector("[data-port]")?.style.opacity);
    const blooms = [...document.querySelectorAll(".liq__bloom")].filter((el) => num(el.style.opacity) > 0.05).length;
    const lines = [...document.querySelectorAll("[data-line]")];
    const printed = lines.filter((l) => l.classList.contains("is-on")).length;
    const lit = [...document.querySelectorAll("[data-ing]")].filter((r) => r.classList.contains("is-lit")).length;
    const st = document.querySelector("[data-st]").getBoundingClientRect().top < 0;
    return {
      y: Math.round(scrollY),
      moving,
      gone,
      n: bottles.length,
      ring: +ring.toFixed(2),
      blooms,
      printed,
      lines: lines.length,
      lit,
      st,
    };
  });
try {
  const p = await (await b.newContext({ viewport: { width: W, height: H } })).newPage();
  await p.goto(`http://localhost:3001/drips/${SLUG}`, { waitUntil: "networkidle", timeout: 240000 });
  await p.waitForTimeout(1500);
  await p.mouse.move(W / 2, H / 2);
  const shots = [];
  const problems = [];
  let maxMoving = 0;
  const clip = await p.evaluate((w) => {
    const r = document.querySelector(w < 900 ? ".dp__bagcol" : ".dp__rig").getBoundingClientRect();
    return {
      x: Math.max(0, r.left - 30),
      y: Math.max(0, r.top - 30),
      width: Math.min(w - Math.max(0, r.left - 30), r.width + 60),
      height: r.height + 60,
    };
  }, W);
  const sample = async (label) => {
    const s = await state(p);
    maxMoving = Math.max(maxMoving, s.moving);
    if (s.moving > 1) problems.push(`${label}: ${s.moving} bottles moving at once`);
    if (s.st && s.ring > 0.02) problems.push(`${label}: the port's ring showing in the scene`);
    shots.push({
      label: `${label} y${s.y} mv${s.moving} gone${s.gone}/${s.n} pr${s.printed}/${s.lines}${s.st ? " SCENE" : ""}`,
      png: (await p.screenshot({ clip })).toString("base64"),
    });
    return s;
  };
  // Down, quickly, until the scene is well under way.
  let s;
  for (let k = 0; k < 30; k++) {
    await p.mouse.wheel(0, 100);
    await p.waitForTimeout(GAP);
    s = await sample(`down ${k}`);
    if (s.st && k > 2 && shots.length > 6 && s.y > 0) {
      // two more notches into the scene
      if (shots.filter((x) => x.label.includes("SCENE")).length >= 3) break;
    }
  }
  // Settle, then check the bag is complete.
  await p.waitForTimeout(1200);
  const end = await state(p);
  console.log("after the quick scroll down:", JSON.stringify(end));
  if (end.moving) problems.push(`left moving after settling: ${end.moving}`);
  if (end.gone !== end.n) problems.push(`not every bottle went in: ${end.gone}/${end.n}`);
  if (end.printed !== end.lines) problems.push(`not every label line printed: ${end.printed}/${end.lines}`);
  // Back up, quickly, to above the list.
  for (let k = 0; k < 16; k++) {
    await p.mouse.wheel(0, -100);
    await p.waitForTimeout(GAP);
    await sample(`up ${k}`);
  }
  await p.waitForTimeout(3500);
  const back = await state(p);
  console.log("after the quick scroll back up and settling:", JSON.stringify(back));
  if (back.moving) problems.push(`left moving after scrolling back: ${back.moving}`);
  if (back.gone || back.printed)
    problems.push(`not all back on the shelf: ${back.gone} gone, ${back.printed} lines printed`);
  console.log(`most bottles moving at once: ${maxMoving}`);
  console.log(problems.length ? "PROBLEMS:\n  " + problems.join("\n  ") : "no problems found");
  if (OUT) {
    const q = await (await b.newContext({ viewport: { width: 1900, height: 1000 } })).newPage();
    await q.setContent(
      `<body style="margin:0;background:#222;display:flex;flex-wrap:wrap;gap:4px;color:#eee;font:10px sans-serif">${shots
        .map(
          (x) =>
            `<figure style="margin:0;width:150px"><img src="data:image/png;base64,${x.png}" style="width:150px;display:block">${x.label}</figure>`
        )
        .join("")}</body>`
    );
    await q.waitForTimeout(400);
    await q.screenshot({ path: OUT, fullPage: true });
  }
} finally {
  await b.close();
}
