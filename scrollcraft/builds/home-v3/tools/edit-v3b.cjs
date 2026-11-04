// One-off edit (v3b, 2026-10-30, user review): the drop goes back to the
// client's scrubbed chamber video, and the hero bag becomes the client's
// photograph with its print lifted off and the same words set in HTML.
const fs = require("fs");
const R = "scrollcraft/builds/home-v3";
function edit(file, pairs) {
  const f = `${R}/${file}`;
  let s = fs.readFileSync(f, "utf8");
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`MISSING in ${file}: ${a.slice(0, 80)}`);
    s = s.replace(a, b);
  }
  fs.writeFileSync(f, s);
}

// ------------------------------------------------------------- render.mjs
const render = fs.readFileSync(`${R}/tools/render.mjs`, "utf8");
const dropStart = render.indexOf('  <section class="drop act-res"');
const dropEnd = render.indexOf("</section>", dropStart) + "</section>".length;
if (dropStart < 0) throw new Error("drop section not found");
const dropNew = `  <section class="drop act-res" data-sc-act="scrub" data-sc-span="2.2" data-sc-dwell="0.3" style="--span:2.2;--span-m:2.2" aria-label="A drop forming in the drip chamber">
    <div data-sc-stage class="drop__stage">
      <picture><source media="(max-width: 860px)" srcset="assets/chamber-poster-m.webp"><img class="sc-stage__poster" src="assets/chamber-poster.webp" width="1914" height="1080" alt="" loading="lazy"></picture>
      <video data-sc-scrub data-sc-src="assets/chamber.mp4" data-sc-src-mobile="assets/chamber-m.mp4" muted playsinline preload="none"></video>
      <div class="drop__scrim" aria-hidden="true"></div>
      <div class="sc-copy drop__copy" data-sc-cue="0.12 0.9">
        <h2 class="drop__h">It starts with one drop.</h2>
        <p class="drop__p"><span data-chosen-name>\${esc(chosen.name)}</span> runs over <span data-chosen-duration>\${esc(duration(chosen))}</span>. What goes into the bag is decided before the first drop falls.</p>
      </div>
    </div>
  </section>`;
fs.writeFileSync(`${R}/tools/render.mjs`, render.slice(0, dropStart) + dropNew + render.slice(dropEnd));

edit("tools/render.mjs", [
  [
    `    <img class="hero__plane hero__back hero__back--1" src="assets/bag-blur-a.webp" width="289" height="600" alt="">
    <img class="hero__plane hero__back hero__back--2" src="assets/bag-blur-b.webp" width="289" height="600" alt="">`,
    `    <img class="hero__plane hero__back hero__back--1" src="assets/hero-back-1.webp" width="279" height="640" alt="">
    <img class="hero__plane hero__back hero__back--2" src="assets/hero-back-2.webp" width="279" height="640" alt="">`,
  ],
  [
    `    <div class="hero__plane hero__bag">\${bag(chosen, { lazy: false })}</div>
    <img class="hero__plane hero__front" src="assets/bag-blur-front.webp" width="289" height="600" alt="">`,
    `    <div class="hero__plane hero__bag">
      <img src="assets/bag-hero-clean.webp" width="611" height="1400" alt="A NutriDrip \${num(chosen.volumeMl ?? 500)} mL IV nutrient bag hanging in a sunlit infusion room" fetchpriority="high">
      <div class="hb-label" aria-hidden="true">
        <span class="hb-word">NutriDrip<sup>™</sup></span>
        <span class="hb-sub">IV NUTRIENT THERAPY</span>
        <span class="hb-foot"><svg viewBox="0 0 72 34" aria-hidden="true"><path d="M18 17c0-6 4.6-10.6 9.6-10.6 7.6 0 11 10.6 17 10.6s7.6-4.6 7.6-10.6S48 6.4 44.6 6.4C37 6.4 33.6 17 27.6 17 22.6 17 18 12.4 18 6.4" transform="translate(-6 5) scale(1.06)" fill="none" stroke="currentColor" stroke-width="4.2" stroke-linecap="round"/></svg><i></i><b>\${num(chosen.volumeMl ?? 500)} mL</b></span>
      </div>
    </div>
    <img class="hero__plane hero__front" src="assets/hero-front.webp" width="279" height="640" alt="">`,
  ],
]);

// ---------------------------------------------------------------- page.js
const page = fs.readFileSync(`${R}/page.js`, "utf8");
const a = page.indexOf("  // ---------------------------------------------------- v3: the drop");
const b = page.indexOf("  // ---------------------------------------------------- day timeline");
if (a < 0 || b < 0) throw new Error("drop block not found");
fs.writeFileSync(`${R}/page.js`, page.slice(0, a) + page.slice(b));
edit("page.js", [
  [
    `  // ---------------------------------------------------- prepare the acts`,
    `  // ---------------------------------------------------- clip codec fallback
  // As the client's home.js: webm where h264 will not play.
  var tv = doc.createElement("video");
  if (!tv.canPlayType('video/mp4; codecs="avc1.42E01E"') && tv.canPlayType('video/webm; codecs="vp9"')) {
    $$("video[data-sc-src]").forEach(function (v) { v.setAttribute("data-sc-src", v.getAttribute("data-sc-src").replace(/\\.mp4$/, ".webm")); v.setAttribute("data-sc-src-mobile", v.getAttribute("data-sc-src-mobile").replace(/\\.mp4$/, ".webm")); });
  }

  // ---------------------------------------------------- prepare the acts`,
  ],
  ["      var pr = prog(drop); if (pr !== last.r) { renderDrop(pr); last.r = pr; }\n", ""],
  [
    '  addEventListener("resize", function () { measure(); measureDrop(); last = {}; });',
    '  addEventListener("resize", function () { measure(); last = {}; });',
  ],
  ["  setChosen(chosen());\n  measureDrop();\n", "  setChosen(chosen());\n"],
  ["    renderBuild(1);\n    renderDrop(0.3);\n", "    renderBuild(1);\n"],
  [
    "doc.fonts.ready.then(function () { measure(); measureDrop(); last = {}; });",
    "doc.fonts.ready.then(function () { measure(); last = {}; });",
  ],
  [
    'addEventListener("load", function () { measure(); measureDrop(); last = {}; });',
    'addEventListener("load", function () { measure(); last = {}; });',
  ],
]);

// ---------------------------------------------------------- patch-css.cjs
edit("tools/patch-css.cjs", [
  // The hero bag goes back to the client's own rule (the photograph).
  [
    `    [
      ".hero__bag { left: 55%; top: calc(var(--bar-h) - 6vh); height: 88vh; aspect-ratio: 611 / 1400; filter: drop-shadow(0 30px 40px rgba(40, 44, 30, .18)); }\\n.hero__bag img { height: 100%; width: auto; max-width: none; }",
      "/* v3: our bag, the empty photo plus a tinted fill and an HTML label. */\\n.hero__bag { left: 55%; top: calc(var(--bar-h) - 2vh); height: 86vh; aspect-ratio: 577 / 1200; filter: drop-shadow(0 30px 40px rgba(40, 44, 30, .18)); }\\n.hero__bag .nd-bag { height: 100%; width: auto; }",
    ],
`,
    "",
  ],
  // The drop goes back to the client's own rule (scrubbed video).
  [
    `    [
      ".drop__stage .sc-stage__poster, .drop__stage video { object-fit: cover; }",
      "/* v3: no video. The chamber frame is a plate; page.js draws the drop. */\\n.drop__scene { position: absolute; inset: 0; transform-origin: 0 0; transform: scale(1.02); will-change: transform; }\\n.drop__plate { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: 50% 30%; max-width: none; }\\n.drop__svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }",
    ],
`,
    "",
  ],
  // The baked blur now copies the client's filters exactly (prepare.mjs).
  [
    `/* v3: blur baked into the images (tools/prepare.mjs), not a CSS filter on a moving plane. */`,
    `/* v3: the client's filters (blur, hue, saturation) baked into the images by tools/prepare.mjs, not run on a moving plane every frame. */`,
  ],
  [
    `.nd-slip__body { margin-bottom: 1.2rem; }
`,
    `.nd-slip__body { margin-bottom: 1.2rem; }
/* The hero bag's label: the client's print, set in HTML over the photograph's
   blank card (bag-hero-clean.webp). Positions are fractions of the 611 x 1400
   photograph, so the print scales with the bag. */
.hero__bag { container-type: inline-size; }
.hb-label { position: absolute; inset: 0; pointer-events: none; color: #111514; }
.hb-word { position: absolute; left: 26.6%; top: 29.4%; font: 700 12.4cqi/1 var(--sc-font-display); letter-spacing: -0.045em; }
.hb-word sup { font-size: .22em; font-weight: 600; letter-spacing: 0; vertical-align: top; position: relative; top: .3em; margin-left: .12em; }
.hb-sub { position: absolute; left: 27.2%; top: 35.4%; font: 600 2.05cqi/1 var(--sc-font-text); letter-spacing: .34em; color: #1D2422; }
.hb-foot { position: absolute; left: 36%; top: 74.5%; height: 3.3%; display: flex; align-items: center; gap: 3.2cqi; }
.hb-foot svg { width: 11.8cqi; height: auto; display: block; }
.hb-foot i { width: .5cqi; min-width: 1px; align-self: stretch; background: currentColor; }
.hb-foot b { font: 600 5.4cqi/1 var(--sc-font-display); letter-spacing: -0.02em; }
`,
  ],
]);
console.log("v3b edits applied");
