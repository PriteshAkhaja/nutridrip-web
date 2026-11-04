// One-off edit (v3e, 2026-10-30, user review):
// - the formulary card head: the badge wrapped and pushed titles up
// - the build's liquid: eased, with a moving surface and drops
// - the generated ampoule labels: printed into the photograph's own shading
// - the build bag's label: the content spread over the label, not bunched
// Run once from nutridrip-new/. Uses split/join, never String.replace, so
// "$$" in the code survives.
const fs = require("fs");
const R = "scrollcraft/builds/home-v3";
function edit(file, pairs) {
  const f = `${R}/${file}`;
  let s = fs.readFileSync(f, "utf8");
  for (const [a, b] of pairs) {
    const n = s.split(a).length - 1;
    if (n !== 1) throw new Error(`${file}: expected 1 match, found ${n}: ${a.slice(0, 80)}`);
    s = s.split(a).join(b);
  }
  fs.writeFileSync(f, s);
}

// ------------------------------------------------------------- render.mjs
const INF_WAVE = (cls) =>
  `<div class="liq__wave${cls}"><svg viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true"><path class="liq__body" d="M0 6Q12.5 2 25 6T50 6T75 6T100 6T125 6T150 6T175 6T200 6V12H0Z"/><path class="liq__shine" d="M0 6Q12.5 2 25 6T50 6T75 6T100 6T125 6T150 6T175 6T200 6"/></svg></div>`;
edit("tools/render.mjs", [
  [
    "const dose = (i) => `${num(i.dose)} ${unitOf(i.unit)}`;\n",
    "const dose = (i) => `${num(i.dose)} ${unitOf(i.unit)}`;\n" +
      '// The same amount one unit up ("1,000 mcg" is "1 mg"), the second line the\n' +
      "// client's labels print under a dose. Derived, never invented.\n" +
      "const altDose = (i) =>\n" +
      '  i.unit === "mcg" && i.dose >= 1000 ? `(${num(i.dose / 1000)} mg)` : i.unit === "mg" && i.dose >= 1000 ? `(${num(i.dose / 1000)} g)` : null;\n',
  ],
  [
    "  inBag: d.items.filter((i) => !i.separate).map((i) => ({ name: i.name, dose: dose(i), form: i.form })),",
    "  inBag: d.items.filter((i) => !i.separate).map((i) => ({ name: i.name, dose: dose(i), alt: altDose(i), molecule: i.molecule ?? null, form: i.form })),",
  ],
  [
    `<div><h3 id="fc-\${esc(d.slug)}">\${esc(d.name)}</h3><p class="fcard__cat">\${esc(d.category ?? "Wellness")} · \${esc(duration(d))}</p><p class="fcard__price">\${esc(inr(d.priceInr))}\${d.isPopular ? '<span class="fcard__prem">Most booked</span>' : ""}</p></div></div>`,
    `<div class="fcard__head"><h3 id="fc-\${esc(d.slug)}">\${esc(d.name)}</h3><p class="fcard__cat">\${esc(d.category ?? "Wellness")}<span>\${esc(duration(d))}</span></p><p class="fcard__price">\${esc(inr(d.priceInr))}</p>\${d.isPopular ? '<p class="fcard__prem">Most booked</p>' : ""}</div></div>`,
  ],
  [
    `        <div class="nd-bag build__bag" data-build-bag style="--fill:0">
          <div class="nd-bag__fill"></div>`,
    `        <div class="nd-bag build__bag" data-build-bag style="--fill:0">
          <!-- v3e: the liquid. page.js eases the level to where the scroll
               puts it; the surface rolls, and drops fall while it rises. -->
          <div class="nd-bag__fill">
            <div class="liq"><div class="liq__level" data-liq-level>${INF_WAVE(" liq__wave--back")}${INF_WAVE("")}</div></div>
            <i class="liq__drop"></i><i class="liq__drop"></i><i class="liq__drop"></i><i class="liq__drop"></i><i class="liq__drop"></i>
            <i class="liq__ring"></i><i class="liq__ring"></i><i class="liq__ring"></i>
          </div>`,
  ],
  [
    `            <p class="bl-word">NutriDrip<sup>™</sup></p>
            <p class="bl-sub">IV NUTRIENT THERAPY</p>
            <p class="build__lname" data-chosen-name>\${esc(chosen.name)}</p>
            <ul class="build__lines" data-build-lines></ul>
            <p class="bl-foot">\${INFINITY}<i></i><b><span data-chosen-volume>\${num(chosen.volumeMl ?? 500)}</span> mL</b></p>`,
    `            <div class="bl-head"><p class="bl-word">NutriDrip<sup>™</sup></p><p class="bl-sub">IV NUTRIENT THERAPY</p></div>
            <p class="build__lname bl-band" data-chosen-name>\${esc(chosen.name)}</p>
            <ul class="build__lines" data-build-lines></ul>
            <div class="bl-end"><i class="bl-rule"></i><p class="bl-foot">\${INFINITY}<i></i><b><span data-chosen-volume>\${num(chosen.volumeMl ?? 500)}</span> mL</b></p></div>`,
  ],
]);

// ---------------------------------------------------------------- page.js
edit("page.js", [
  [
    `  function vialHTML(it) {
    for (var k = 0; k < PRODUCTS.length; k++) {
      var pr = PRODUCTS[k];
      if (pr[0].test(it.name)) return '<div class="vial__glass" style="aspect-ratio:' + pr[2] + "/" + pr[3] + '"><img src="' + pr[1] + '" alt=""></div>';
    }
    var longest = it.name.split(/\\s+/).reduce(function (m, w) { return Math.max(m, w.length); }, 0);
    var nameSize = Math.min(26, 172 / Math.max(1, longest * 0.8)).toFixed(1); // px at the photograph's 196 px width; uppercase Outfit 800 runs ~0.8em a letter
    return '<div class="vial__glass" style="aspect-ratio:196/900"><img src="assets/ampoule-blank.webp" alt="">' +
      '<div class="vlabel" style="--band:' + band(it.name) + ";--nfs:" + nameSize + 'px">' +
      // <p>, not <span>: the client's ".vial span" rule styles the caption
      // under each vial and would catch every span in the label.
      '<p class="vlabel__word">NutriDrip<sup>™</sup></p><p class="vlabel__sub">IV NUTRIENT THERAPY</p>' +
      '<p class="vlabel__band">' + esc(it.name) + '</p><p class="vlabel__dose">' + esc(it.dose) + "</p>" +
      '<svg class="vlabel__inf" viewBox="0 0 100 50" aria-hidden="true"><path d="M50 25C40 11 33 7 25 7 15 7 7 15 7 25s8 18 18 18c8 0 15-4 25-18s17-18 25-18c10 0 18 8 18 18s-8 18-18 18c-8 0-15-4-25-18Z" fill="none" stroke="currentColor" stroke-width="5"/></svg>' +
      '<i class="vlabel__rule"></i><p class="vlabel__foot">For IV Use Only</p></div></div>';
  }`,
    `  // v3e: the band reads like the client's ("MAGNESIUM / SULFATE 50%",
  // "METHYLCOBALAMIN / (B12)"): the name in up to two balanced lines, then the
  // vitamin it is, when the master records one the name does not say.
  function bandLines(it) {
    var words = it.name.toUpperCase().split(/\\s+/), lines = words;
    if (words.length > 1) {
      var cut = 1, best = 1e9;
      for (var i = 1; i < words.length; i++) {
        var d = Math.abs(words.slice(0, i).join(" ").length - words.slice(i).join(" ").length);
        if (d < best) { best = d; cut = i; }
      }
      lines = [words.slice(0, cut).join(" "), words.slice(cut).join(" ")];
    }
    var vit = it.molecule && /^vitamin\\s+(.+)$/i.exec(it.molecule);
    if (vit && it.name.toLowerCase().indexOf(it.molecule.toLowerCase()) < 0) lines = lines.concat("(" + vit[1].toUpperCase() + ")");
    return lines;
  }
  function vialHTML(it) {
    for (var k = 0; k < PRODUCTS.length; k++) {
      var pr = PRODUCTS[k];
      if (pr[0].test(it.name)) return '<div class="vial__glass" style="aspect-ratio:' + pr[2] + "/" + pr[3] + '"><img src="' + pr[1] + '" alt=""></div>';
    }
    var b = band(it.name);
    return '<div class="vial__glass" style="aspect-ratio:196/900;--band:' + b + '"><img src="assets/ampoule-blank.webp" alt="">' +
      // The coloured ring on the neck, as on every client ampoule.
      '<i class="vring"></i>' +
      // <p>, not <span>: the client's ".vial span" rule styles the caption
      // under each vial and would catch every span in the label.
      '<div class="vlabel">' +
      '<p class="vlabel__word">NutriDrip<sup>™</sup></p><p class="vlabel__sub">IV NUTRIENT THERAPY</p>' +
      '<p class="vlabel__band">' + bandLines(it).map(function (l) { return "<b>" + esc(l) + "</b>"; }).join("") + "</p>" +
      '<div class="vlabel__low"><p class="vlabel__dose">' + esc(it.dose) + (it.alt ? "<small>" + esc(it.alt) + "</small>" : "") + "</p>" +
      '<i class="vlabel__rule"></i>' +
      '<svg class="vlabel__inf" viewBox="0 0 100 50" aria-hidden="true"><path d="M50 25C40 11 33 7 25 7 15 7 7 15 7 25s8 18 18 18c8 0 15-4 25-18s17-18 25-18c10 0 18 8 18 18s-8 18-18 18c-8 0-15-4-25-18Z" fill="none" stroke="currentColor" stroke-width="5"/></svg>' +
      '<p class="vlabel__foot">For IV Use Only</p></div></div></div>';
  }
  // Each band's lines share one size, the largest that keeps the widest line
  // inside the label's printable width (176 of its 196 px), as the client's
  // bands fill theirs. Measured after the fonts load.
  function fitBands() {
    $$(".vlabel__band", vialBox).forEach(function (b) {
      b.style.setProperty("--nfs", "27px");
      var w = $$("b", b).reduce(function (m, l) { return Math.max(m, l.offsetWidth); }, 0);
      if (w) b.style.setProperty("--nfs", Math.min(27, 27 * 172 / w).toFixed(2) + "px");
    });
  }`,
  ],
  [
    `    vialEls = $$(".vial", vialBox);
    scaleLabels();
    var items = (d.carrier ? [d.carrier + " " + d.volume + " mL"] : []).concat(d.inBag.map(function (i) { return i.name + " " + i.dose; }));
    linesEl.innerHTML = items.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") +`,
    `    vialEls = $$(".vial", vialBox);
    scaleLabels();
    fitBands();
    // v3e: two columns, name and dose, as the client's B-complex label.
    var rows = (d.carrier ? [[d.carrier, Number(d.volume).toLocaleString("en-IN") + " mL"]] : []).concat(d.inBag.map(function (i) { return [i.name, i.dose]; }));
    var items = rows.map(function (r) { return r[0] + " " + r[1]; });
    linesEl.innerHTML = rows.map(function (r) { return "<li><span>" + esc(r[0]) + "</span><b>" + esc(r[1]) + "</b></li>"; }).join("") +`,
  ],
  [
    `  var target = { x: 0, y: 0 }, starts = [];
  function measure() {
    if (!bag || !vialEls.length) return;`,
    `  var target = { x: 0, y: 0 }, starts = [], bagH = 0;
  function measure() {
    if (bag) bagH = bag.offsetHeight;
    if (!bag || !vialEls.length) return;`,
  ],
  [
    `    // v3d: each ingredient owns an equal slice of the drop phase. It falls
    // over the first 72% of its slice; the level then rises one step, eased,
    // as it enters, so the bag fills ingredient by ingredient at one steady
    // pace whatever the count (the act's span grows with the count).
    var drop0 = 0.05, drop1 = 0.6, w = (drop1 - drop0) / Math.max(1, n);
    var risen = 0;
    vialEls.forEach(function (v, i) {
      var a = drop0 + i * w;
      var t = seg(p, a, a + 0.72 * w), s = starts[i];
      risen += ease(seg(p, a + 0.62 * w, a + w));`,
    `    // v3d: each ingredient owns an equal slice of the drop phase. It falls
    // over the first 72% of its slice, so the bag fills ingredient by
    // ingredient at one steady pace whatever the count (the act's span grows
    // with the count).
    // v3e: its share of the level pours in from the moment it enters, over
    // 90% of a slice, eased in and out, so one pour runs into the next with
    // no flat steps between. The frame loop then eases the shown level to it.
    var drop0 = 0.05, drop1 = 0.6, w = (drop1 - drop0) / Math.max(1, n);
    var risen = 0;
    vialEls.forEach(function (v, i) {
      var a = drop0 + i * w;
      var t = seg(p, a, a + 0.72 * w), s = starts[i];
      risen += smooth(seg(p, a + 0.6 * w, a + 1.5 * w));`,
  ],
  [
    `    var fill = n ? risen / n : seg(p, drop0, drop1);
    bag.style.setProperty("--fill", fill.toFixed(3));`,
    `    var fill = n ? risen / n : smooth(seg(p, drop0, drop1));
    liq.to = fill;
    if (reduce) { liq.lvl = fill; paintLiquid(0); }`,
  ],
  [
    `  // ---------------------------------------------------- progress helper`,
    `  // ---------------------------------------------------- v3e: the liquid
  // The scroll says where the level is going (liq.to); each frame the level
  // eases a tenth of the way there, so a jerky wheel still pours smoothly.
  // While it rises, drops fall from the top of the bag; each one that lands
  // rings the surface and rocks it, a damped swing that settles by itself.
  function smooth(t) { return t * t * (3 - 2 * t); }
  var levelEl = $("[data-liq-level]"), waveEls = $$(".liq__wave"), dropEls = $$(".liq__drop"), ringEls = $$(".liq__ring");
  var liq = { to: 0, lvl: 0, tilt: 0, tiltV: 0, amp: 0.18, t: 0, next: 0, drops: [], rings: [], still: false };
  function surfaceY() { return bagH * (0.07 + (1 - liq.lvl) * 0.795); } // px from the bag's top: the liquid spans 7% to 86.5%
  function paintLiquid(now) {
    var y = surfaceY();
    levelEl.style.transform = "translate3d(0," + y.toFixed(2) + "px,0) rotate(" + liq.tilt.toFixed(3) + "deg)";
    waveEls.forEach(function (w) { w.style.transform = "scaleY(" + liq.amp.toFixed(3) + ")"; w.style.opacity = String(Math.min(1, liq.lvl * 30)); });
    liq.drops.forEach(function (d) {
      d.el.style.transform = "translate3d(" + d.x.toFixed(1) + "px," + d.y.toFixed(1) + "px,0) scaleY(" + (1 + Math.min(0.5, d.v / bagH * 30)).toFixed(3) + ")";
    });
    liq.rings.forEach(function (r) {
      var k = (now - r.born) / 480;
      r.el.style.transform = "translate3d(" + r.x.toFixed(1) + "px," + y.toFixed(1) + "px,0) scale(" + (0.35 + k * 1.1).toFixed(3) + ")";
      r.el.style.opacity = String(Math.max(0, 0.85 * (1 - k)));
    });
  }
  function liquidTick(now) {
    if (!bagH) return;
    var f = liq.t ? Math.min(4, (now - liq.t) / 16.7) : 1; liq.t = now;
    liq.lvl += (liq.to - liq.lvl) * (1 - Math.pow(0.9, f));
    if (Math.abs(liq.to - liq.lvl) < 0.0004) liq.lvl = liq.to;
    var rising = liq.to - liq.lvl > 0.003;
    liq.tiltV += (-0.035 * liq.tilt - 0.09 * liq.tiltV) * f;
    liq.tilt = clamp(liq.tilt + liq.tiltV * f, -2.5, 2.5);
    liq.amp += ((rising ? 1 : 0.18) - liq.amp) * (1 - Math.pow(0.94, f));
    if (rising && now >= liq.next && liq.lvl < 0.98) {
      var free = dropEls.filter(function (el) { return !liq.drops.some(function (d) { return d.el === el; }); })[0];
      if (free) { liq.drops.push({ el: free, x: (Math.random() - 0.5) * bagH * 0.014, y: bagH * 0.075, v: bagH * 0.002 }); free.style.opacity = "0.95"; }
      liq.next = now + 105;
    }
    var surf = surfaceY();
    liq.drops = liq.drops.filter(function (d) {
      d.v += bagH * 0.0012 * f; d.y += d.v * f;
      if (d.y < surf - bagH * 0.01) return true;
      d.el.style.opacity = "0";
      var ring = ringEls.filter(function (el) { return !liq.rings.some(function (r) { return r.el === el; }); })[0];
      if (ring) liq.rings.push({ el: ring, x: d.x, born: now });
      liq.tiltV += (Math.random() < 0.5 ? -1 : 1) * 0.06;
      return false;
    });
    liq.rings = liq.rings.filter(function (r) { if (now - r.born < 480) return true; r.el.style.opacity = "0"; return false; });
    var still = !rising && !liq.drops.length && !liq.rings.length && Math.abs(liq.tilt) < 0.004 && Math.abs(liq.tiltV) < 0.0004 && Math.abs(liq.amp - 0.18) < 0.002 && liq.lvl === liq.to;
    if (still && liq.still) return; // nothing moved since the last paint
    liq.still = still;
    paintLiquid(now);
  }

  // ---------------------------------------------------- progress helper`,
  ],
  [
    `      var pb = prog(build); if (pb !== last.b) { renderBuild(pb); last.b = pb; }`,
    `      var pb = prog(build); if (pb !== last.b) { renderBuild(pb); last.b = pb; }
      var brr = build.getBoundingClientRect(), live = brr.top < innerHeight && brr.bottom > 0;
      if (live !== last.live) { bag.classList.toggle("is-live", live); last.live = live; }
      if (live) liquidTick(performance.now());`,
  ],
  [
    `    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { measure(); measurePath(); last = {}; });`,
    `    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { fitBands(); measure(); measurePath(); last = {}; });`,
  ],
]);

// ---------------------------------------------------------- patch-css.cjs
edit("tools/patch-css.cjs", [
  // The generated ampoule label, v3e.
  [
    `.vlabel { position: absolute; left: 0; top: 49.6%; width: 196px; height: 370px; transform-origin: 0 0; transform: scale(var(--k, .15)); display: flex; flex-direction: column; align-items: center; text-align: center; color: #121614; padding-top: 22px; }
.vlabel__word { font: 800 37px/1 var(--sc-font-display); letter-spacing: -0.045em; }
.vlabel__word sup { font-size: .3em; font-weight: 600; vertical-align: top; position: relative; top: .1em; }
.vlabel__sub { margin-top: 6px; font: 600 9px/1 var(--sc-font-text); letter-spacing: .08em; color: #2A3230; white-space: nowrap; }
.vlabel__band { align-self: stretch; margin-top: 20px; padding: 16px 8px; background: var(--band); font: 800 var(--nfs, 24px)/1.04 var(--sc-font-display); letter-spacing: -0.01em; text-transform: uppercase; overflow-wrap: anywhere; }
.vlabel__dose { margin-top: 22px; font: 700 27px/1 var(--sc-font-display); letter-spacing: -0.02em; }
.vlabel__inf { width: 40px; height: auto; margin-top: auto; }
.vlabel__rule { width: 46%; height: 3px; margin-top: 12px; background: var(--band); }
.vlabel__foot { margin: 10px 0 16px; font: 500 16px/1 var(--sc-font-text); }`,
    `/* v3e: the print multiplies into the photograph's label, so the shading of
   the curved glass (darker toward each edge) runs through the ink and the
   band exactly as it does on the client's own photos. The content fills the
   label as theirs does: word, band, dose, then rule, ∞ and the route spread
   evenly to the bottom edge. */
.vlabel { position: absolute; left: 0; top: 49.6%; width: 196px; height: 370px; transform-origin: 0 0; transform: scale(var(--k, .15)); display: flex; flex-direction: column; align-items: center; text-align: center; color: #141816; padding: 17px 0 12px; mix-blend-mode: multiply; }
.vlabel__word { font: 800 36px/1 var(--sc-font-display); letter-spacing: -0.045em; }
.vlabel__word sup { font-size: .26em; font-weight: 600; vertical-align: top; position: relative; top: .15em; margin-left: .06em; letter-spacing: 0; }
.vlabel__sub { margin-top: 5px; font: 600 9.5px/1 var(--sc-font-text); letter-spacing: .13em; color: #26302D; white-space: nowrap; }
.vlabel__band { align-self: stretch; margin-top: 13px; padding: 11px 0 10px; background: var(--band); display: grid; gap: 1px; color: #19202C; }
.vlabel__band b { display: block; width: max-content; margin-inline: auto; font: 800 var(--nfs, 24px)/1.06 var(--sc-font-display); letter-spacing: -0.012em; }
.vlabel__low { flex: 1; align-self: stretch; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding-top: 15px; }
.vlabel__dose { display: flex; flex-direction: column; align-items: center; gap: 6px; font: 700 29px/1 var(--sc-font-display); letter-spacing: -0.02em; }
.vlabel__dose small { font: 500 18px/1 var(--sc-font-text); letter-spacing: 0; color: #2A3230; }
.vlabel__rule { width: 72px; height: 3px; border-radius: 2px; background: var(--band); }
.vlabel__inf { width: 44px; height: auto; color: #1A1F1D; }
.vlabel__foot { font: 500 16px/1 var(--sc-font-text); color: #1E2422; }
/* The neck ring (rows 304-319, x 50-144 of the photograph), painted glass:
   lit in the middle, falling off round the curve. */
.vring { position: absolute; left: 25.5%; width: 48%; top: 33.78%; height: 1.78%; background: linear-gradient(90deg, color-mix(in oklab, var(--band) 62%, #000) 0%, var(--band) 20%, color-mix(in oklab, var(--band) 55%, #fff) 42%, var(--band) 68%, color-mix(in oklab, var(--band) 58%, #000) 100%); }`,
  ],
  // The build bag's label, v3e.
  [
    `.build__label { left: 16.5%; right: 16.5%; top: 23%; bottom: 17%; padding: 9cqi 8cqi 6cqi; border-radius: 5cqi; gap: 0; color: #111514; box-shadow: 0 1px 0 rgba(0,0,0,.04), 0 10px 24px rgba(0,0,0,.18); }`,
    `/* v3e: four groups (wordmark, name band, doses, rule and volume) spread over
   the label, so it reads full like the client's labels instead of bunching at
   the top. Printed on the bag: a flat card with a soft edge and the bag's
   sheen across it, not a floating sticker. */
.build__label { left: 16.5%; right: 16.5%; top: 23%; bottom: 17%; padding: 8cqi 0 6.5cqi; border-radius: 4cqi; gap: 0; justify-content: space-between; color: #111514; overflow: hidden; background: linear-gradient(100deg, #F1F4F2 0%, #fff 16%, #fff 64%, #ECEFED 100%); box-shadow: 0 0 0 1px rgba(0,0,0,.05), 0 3px 10px rgba(0,0,0,.14); }
.build__label::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(104deg, rgba(255,255,255,0) 34%, rgba(255,255,255,.55) 43%, rgba(255,255,255,0) 52%); mix-blend-mode: screen; }
.bl-head { padding: 0 7.5cqi; }
.build__label .bl-band { margin: 0; padding: 2.6cqi 7.5cqi 2.3cqi; border: 0; background: color-mix(in oklab, var(--tint) 30%, #fff); color: #141A26; font: 800 6.4cqi/1.05 var(--sc-font-display); letter-spacing: -0.012em; text-transform: uppercase; }
.build__label .build__lines { flex: none; margin: 0; padding: 0 7.5cqi; font: 500 3.3cqi/1.4 var(--sc-font-text); gap: .6cqi; }
.build__label .build__lines li { display: grid; grid-template-columns: auto 1fr auto; align-items: baseline; column-gap: 1.6cqi; }
.build__label .build__lines li::before { margin: 0; align-self: center; }
.build__label .build__lines li b { font-weight: 650; white-space: nowrap; }
.build__label .build__lines .build__lsep { display: block; margin-top: .8cqi; color: #46524F; font-size: .92em; }
.build__label .build__lines .build__lsep::before { background: transparent; border: 1px solid var(--tint); margin-right: 1.6cqi; }
.bl-end { display: grid; justify-items: center; gap: 3cqi; padding: 0 7.5cqi; }
.bl-rule { width: 28cqi; height: .7cqi; border-radius: 1cqi; background: color-mix(in oklab, var(--tint) 55%, #fff); }`,
  ],
  [
    `.build__label .build__lname { margin-top: 6cqi; padding-top: 3.5cqi; border-top: 1px solid #D7DEDA; font: 700 6cqi/1.05 var(--sc-font-display); letter-spacing: -0.02em; }
.build__label .build__lines { margin-top: 3cqi; font-size: 3cqi; line-height: 1.32; gap: .6cqi; }
`,
    ``,
  ],
  [
    `.bl-foot { margin: auto 0 0; padding-top: 3cqi; display: flex; align-items: center; justify-content: center; gap: 2.6cqi; height: 9cqi; }`,
    `.bl-foot { margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; gap: 2.6cqi; height: 8cqi; }`,
  ],
  [
    `  .build__label { left: 14%; right: 14%; top: 22%; bottom: 18%; padding: 8cqi 7cqi 5cqi; }
  .build__label .build__lines { font-size: 3.6cqi; }`,
    `  .build__label { left: 14%; right: 14%; top: 22%; bottom: 18%; padding: 7cqi 0 5.5cqi; }
  .build__label .build__lines { font-size: 3.6cqi; }`,
  ],
  // Appended rules, v3e.
  [
    `/* The time column only where it fits; every card above already shows it. */`,
    `/* v3e: the formulary card head. The badge sat in the price row, wrapped to
   two lines and pushed its card's title up; a category that wrapped did the
   same, so titles and prices sat at different heights across the rail. Every
   head now has the same rows (name, category, duration, price) on the bag's
   baseline, and the badge sits in the card's corner. */
.fcard { position: relative; }
.fcard__cat span { display: block; }
.fcard__price { display: block; }
.fcard__prem { position: absolute; top: .95rem; right: .95rem; margin: 0; white-space: nowrap; }
/* v3e: the build bag's liquid. A level the width of the bag (wider, so a tilt
   never shows its corners) moves by transform only; two rolling waves make the
   surface, a white line its meniscus. All of it sits inside the bag's mask. */
.build__bag .nd-bag__fill::before, .build__bag .nd-bag__fill::after { content: none; }
.liq { position: absolute; inset: 0 0 13.5% 0; overflow: hidden; opacity: .88; }
.liq__level { position: absolute; left: -12%; right: -12%; top: 0; height: 100%; transform: translateY(100%); transform-origin: 50% 0; will-change: transform; background: linear-gradient(180deg, color-mix(in oklab, var(--tint) 56%, #fff) 0, color-mix(in oklab, var(--tint) 78%, #fff) 24%, var(--tint) 100%); }
.liq__wave { position: absolute; left: 0; right: 0; bottom: calc(100% - 1px); height: 4.5cqi; overflow: hidden; transform-origin: 50% 100%; transform: scaleY(.18); opacity: 0; }
.liq__wave--back { height: 6.5cqi; }
.liq__wave--back .liq__body { opacity: .45; }
.liq__wave--back .liq__shine { display: none; }
.liq__wave svg { display: block; width: 200%; height: 100%; animation: liq-roll 3.6s linear infinite paused; }
.liq__wave--back svg { animation-duration: 5.4s; animation-direction: reverse; }
.is-live .liq__wave svg { animation-play-state: running; }
.liq__body { fill: color-mix(in oklab, var(--tint) 56%, #fff); }
.liq__shine { fill: none; stroke: rgba(255,255,255,.9); stroke-width: 1.4; vector-effect: non-scaling-stroke; }
@keyframes liq-roll { to { transform: translateX(-50%); } }
.liq__drop { position: absolute; left: 50%; top: 0; width: 2.4cqi; height: 3.3cqi; margin-left: -1.2cqi; border-radius: 50% 50% 50% 50% / 62% 62% 38% 38%; background: radial-gradient(circle at 35% 35%, #fff 0 18%, color-mix(in oklab, var(--tint) 45%, #fff) 40%, color-mix(in oklab, var(--tint) 80%, #fff) 100%); opacity: 0; will-change: transform; }
.liq__ring { position: absolute; left: 50%; top: 0; width: 13cqi; height: 2.6cqi; margin: -1.3cqi 0 0 -6.5cqi; border-radius: 50%; border: 1.5px solid rgba(255,255,255,.85); opacity: 0; will-change: transform, opacity; }
@media (prefers-reduced-motion: reduce) { .liq__wave svg { animation: none; } }
/* The time column only where it fits; every card above already shows it. */`,
  ],
]);
console.log("v3e edits applied");
