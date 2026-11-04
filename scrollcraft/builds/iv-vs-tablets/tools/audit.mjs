// Section-by-section audit of the IV vs Tablets page (ours or the client's).
//
//   node scrollcraft/builds/iv-vs-tablets/tools/audit.mjs <url> <W> <H> <outDir> [reduced]
//
// Screenshots every section, and the routes act at the progress points where
// the dose should sit on each node. Measures: the dose against its node, each
// line's ends against the first and last node, the end panel against the
// grid, anything under the fixed header, and horizontal overflow. Writes
// <outDir>/audit.json and <outDir>/*.png. Run from nutridrip-new/.
import { chromium } from "file:///C:/Trakshym/Nutridrip/nutridrip-new/scrollcraft/builds/home-v2/node_modules/playwright-core/index.mjs";
import fs from "node:fs";
import path from "node:path";

const [, , URL, W, H, OUT, RED] = process.argv;
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: true,
});
const report = { url: URL, W: +W, H: +H, reduced: !!RED, errs: [], sections: [], act: [] };
try {
  const ctx = await browser.newContext({
    viewport: { width: +W, height: +H },
    isMobile: +W < 900,
    hasTouch: +W < 900,
    reducedMotion: RED ? "reduce" : "no-preference",
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();
  page.on("console", (m) => m.type() === "error" && report.errs.push(m.text()));
  page.on("requestfailed", (r) => report.errs.push("FAILED " + r.url()));
  page.on("response", (r) => {
    if (r.status() >= 400) report.errs.push(r.status() + " " + r.url());
  });
  await page.goto(URL, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400);

  const overflow = () =>
    page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    }));
  report.overflow = await overflow();
  // Elements wider than the screen or poking out of it (text, images, buttons).
  report.poking = await page.evaluate(() =>
    [...document.querySelectorAll("main *, header *, footer *")]
      .filter((e) => {
        if (!e.offsetParent && getComputedStyle(e).position !== "fixed") return false;
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1);
      })
      .filter((e) => !e.closest("[aria-hidden=true]") && !e.closest(".nd-ledger") && !e.closest(".visually-hidden"))
      .slice(0, 12)
      .map(
        (e) =>
          `${e.tagName}.${String(e.className).split(" ")[0]} ${Math.round(e.getBoundingClientRect().left)}..${Math.round(e.getBoundingClientRect().right)}`
      )
  );

  // ---- the routes act, at each node and between them
  const act = await page.$(".routes");
  const at = [0, 0.1, 0.1804, 0.205, 0.28, 0.3772, 0.47, 0.574, 0.66, 0.7544, 0.8, 0.86, 0.92, 1];
  for (const p of RED ? [1] : at) {
    await page.evaluate((p) => {
      const a = document.querySelector(".routes"),
        top = a.getBoundingClientRect().top + scrollY;
      scrollTo(0, Math.round(top + p * Math.max(0, a.offsetHeight - innerHeight)));
    }, p);
    await page.waitForTimeout(650);
    const m = await page.evaluate(() => {
      const bar = document.querySelector(".nd-bar").getBoundingClientRect().bottom;
      const centreOf = (li) => {
        const cs = getComputedStyle(li, "::before"),
          r = li.getBoundingClientRect();
        const tr = (cs.translate && cs.translate !== "none" ? cs.translate : "0 0").split(" ");
        return [
          r.left + parseFloat(cs.left) + parseFloat(cs.width) / 2 + (parseFloat(tr[0]) || 0),
          r.top + parseFloat(cs.top) + parseFloat(cs.height) / 2 + (parseFloat(tr[1] || tr[0]) || 0),
        ];
      };
      const routes = [...document.querySelectorAll(".route")].map((R) => {
        const lis = [...R.querySelectorAll(".route__path li")],
          path = R.querySelector(".route__path");
        const nodes = lis.map(centreOf);
        const d = R.querySelector(".route__dose").getBoundingClientRect();
        const dose = [d.left + d.width / 2, d.top + d.height / 2];
        const near = nodes
          .map((n, i) => [i, Math.hypot(n[0] - dose[0], n[1] - dose[1])])
          .sort((a, b) => a[1] - b[1])[0];
        const ls = getComputedStyle(path, "::before"),
          pr = path.getBoundingClientRect();
        const line = {
          x0: pr.left + parseFloat(ls.left),
          y0: pr.top + parseFloat(ls.top),
          w: parseFloat(ls.width),
          h: parseFloat(ls.height),
        };
        const vertical = line.h > line.w;
        const lineStart = vertical ? [line.x0 + line.w / 2, line.y0] : [line.x0, line.y0 + line.h / 2];
        const lineEnd = vertical ? [line.x0 + line.w / 2, line.y0 + line.h] : [line.x0 + line.w, line.y0 + line.h / 2];
        const f = (v) => v.map((x) => Math.round(x * 10) / 10);
        return {
          k: R.getAttribute("data-route"),
          lv: R.querySelector("[data-lv]").textContent,
          meter: getComputedStyle(R.querySelector(".route__meter span")).transform,
          on: lis
            .map((li) => (li.classList.contains("is-now") ? "N" : li.classList.contains("is-on") ? "o" : "-"))
            .join(""),
          dose: f(dose),
          nearNode: near[0],
          doseOff: Math.round(near[1] * 10) / 10,
          lineStartOff: f([lineStart[0] - nodes[0][0], lineStart[1] - nodes[0][1]]),
          lineEndOff: f([lineEnd[0] - nodes.at(-1)[0], lineEnd[1] - nodes.at(-1)[1]]),
          headTop: Math.round(R.querySelector(".route__head").getBoundingClientRect().top),
          lastNodeY: Math.round(nodes.at(-1)[1]),
          notesBottom: Math.round(
            Math.max(
              ...lis.map((li) => {
                const p = li.querySelector("p");
                const r = p.getBoundingClientRect();
                return getComputedStyle(p).opacity > 0.05 ? r.bottom : 0;
              })
            )
          ),
        };
      });
      const g = document.querySelector(".routes__grid").getBoundingClientRect(),
        e = document.querySelector(".routes__end"),
        er = e.getBoundingClientRect();
      const eo = +getComputedStyle(e).opacity;
      const st = document.querySelector(".nd-sticky"),
        sr = st ? st.getBoundingClientRect() : null;
      return {
        bar: Math.round(bar),
        state: document.querySelector(".routes__stage").getAttribute("data-sc-verify-state"),
        routes,
        gridBottom: Math.round(g.bottom),
        endTop: Math.round(er.top),
        endBottom: Math.round(er.bottom),
        endOpacity: eo,
        vh: innerHeight,
        stickyOn:
          st && st.classList.contains("is-on") && getComputedStyle(st).display !== "none" ? Math.round(sr.top) : null,
      };
    });
    m.p = p;
    report.act.push(m);
    await page.screenshot({ path: path.join(OUT, `act-${String(Math.round(p * 1000)).padStart(4, "0")}.png`) });
  }

  // ---- every other section, top of it aligned under the header
  const secs = await page.evaluate(() =>
    [...document.querySelectorAll("main > section, footer")].map((s, i) => ({
      i,
      cls: s.className.split(" ")[0] || s.tagName,
      top: s.getBoundingClientRect().top + scrollY,
      h: s.offsetHeight,
    }))
  );
  for (const s of secs) {
    if (s.cls === "routes") continue;
    await page.evaluate((y) => scrollTo(0, y), Math.max(0, Math.round(s.top - (s.i === 0 ? 0 : 0))));
    await page.waitForTimeout(450);
    const info = await page.evaluate((i) => {
      const s = document.querySelectorAll("main > section, footer")[i],
        bar = document.querySelector(".nd-bar").getBoundingClientRect().bottom;
      // The first text inside the section must start below the header.
      const firstText = [...s.querySelectorAll("h1,h2,h3,p,li,a,img")].find((e) => e.offsetParent);
      const ft = firstText ? firstText.getBoundingClientRect().top : null;
      return { bar: Math.round(bar), firstTextTop: ft == null ? null : Math.round(ft), h: s.offsetHeight };
    }, s.i);
    report.sections.push({ ...s, ...info });
    await page.screenshot({ path: path.join(OUT, `sec-${s.i}-${s.cls}.png`) });
    if (s.h > +H * 1.1) {
      await page.evaluate((y) => scrollTo(0, y), Math.round(s.top + s.h - +H));
      await page.waitForTimeout(350);
      await page.screenshot({ path: path.join(OUT, `sec-${s.i}-${s.cls}-end.png`) });
    }
  }
  report.overflowAfter = await overflow();
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(OUT, "audit.json"), JSON.stringify(report, null, 1));
const bad = report.act.flatMap((m) =>
  m.routes
    .filter((r) => r.lineStartOff.some((v) => Math.abs(v) > 1.5) || r.lineEndOff.some((v) => Math.abs(v) > 1.5))
    .map((r) => `p${m.p} ${r.k} line ${r.lineStartOff}/${r.lineEndOff}`)
);
console.log(
  JSON.stringify({
    W,
    H,
    errs: report.errs.length,
    overflow: report.overflow,
    poking: report.poking.length,
    lineIssues: bad.slice(0, 6),
  })
);
