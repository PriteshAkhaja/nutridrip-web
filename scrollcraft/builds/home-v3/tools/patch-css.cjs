// Copies the client's site.css and home.css into v3 and patches them where
// marked "v3:". Re-runnable: always starts again from the client's originals.
//   node scrollcraft/builds/home-v3/tools/patch-css.cjs   (from nutridrip-new/)
const fs = require("fs");
const path = require("path");

const ROOT = "scrollcraft/builds/home-v3";
const SRC = "_reference/NutriDrip IV Nutrient Therapy/assets/css";
fs.copyFileSync(path.join(SRC, "site.css"), path.join(ROOT, "site.css"));
fs.copyFileSync(path.join(SRC, "home.css"), path.join(ROOT, "home.css"));

function patch(file, pairs, extra = "") {
  const f = path.join(ROOT, file);
  let s = fs.readFileSync(f, "utf8");
  for (const [a, b] of pairs) {
    if (!s.includes(a)) throw new Error(`MISSING in ${file}: ${a.slice(0, 90)}`);
    s = s.split(a).join(b);
  }
  fs.writeFileSync(f, s + extra);
}

patch(
  "site.css",
  [
    ["url(../fonts/", "url(fonts/"],
    [
      "/* NutriDrip v2: page layer over scrollcraft.css. Tokens first. */",
      '/* NutriDrip v3 prototype: the client\'s site.css, patched where marked "v3:". */',
    ],
    [
      "background: rgba(245, 247, 245, .92); backdrop-filter: saturate(1.4) blur(10px); -webkit-backdrop-filter: saturate(1.4) blur(10px);",
      "background: rgba(245, 247, 245, .97); /* v3: no backdrop blur on a sticky layer */",
    ],
    [
      "pointer-events: none; transition: opacity 180ms var(--sc-ease-out), transform 180ms var(--sc-ease-out); }\n.nd-ledger.is-open { opacity: 1; transform: none; pointer-events: auto; }",
      "pointer-events: none; visibility: hidden; transition: opacity 180ms var(--sc-ease-out), transform 180ms var(--sc-ease-out), visibility 0s linear 180ms; }\n/* v3: hidden from the keyboard while closed (the artifact left 12 invisible tab stops). */\n.nd-ledger.is-open { opacity: 1; transform: none; pointer-events: auto; visibility: visible; transition-delay: 0s; }",
    ],
    ["url(../img/bag-mask.png)", "url(assets/bag-mask.png)"],
  ],
  `
/* ------------------------------------------------------------------ v3 */
.nd-mark-link { text-decoration: none; color: inherit; display: inline-flex; }
.nd-bar__book .nd-cta { flex-direction: row; align-items: center; gap: .7rem; }
.nd-bar__book .nd-cta__free { font-size: .78rem; line-height: 1.25; max-width: 9.5rem; }
.nd-bar__book .nd-cta__free::before { display: none; }
.nd-bar__book .nd-btn[href="/login"] { background: transparent; color: var(--sc-ink); border-color: var(--nd-line); }
@media (max-width: 1180px) { .nd-bar__book .nd-btn[href="/login"] { display: none; } }
@media (max-width: 860px) {
  .nd-bar__book .nd-cta__free { display: none; }
  .nd-bar__book .nd-btn { min-height: 40px; padding: .5rem .9rem; font-size: .88rem; }
}
/* v3e: the header row (shared chrome, so it lives in site.css). The question button grows with the question; on the
   long ones ("What if it's not right for me?") the row ran out of room and
   the browser squeezed everything: the logo's tagline broke onto two lines
   and the note beside the quiz button wrapped to four, out of the bar. Now
   the logo, the links and the buttons keep their size; only the question may
   give way (ellipsis, full text in the menu and the button's title). The note
   is dropped on desktop: with seven links it cannot share the row with the
   longer questions, and every quiz button below carries the same line. */
.nd-bar__nav a { white-space: nowrap; }
.nd-mark, .nd-bar__nav, .nd-bar__book { flex-shrink: 0; }
.nd-mark small { white-space: nowrap; }
.nd-bar__end { min-width: 0; }
.nd-ledger-btn { min-width: 0; flex: 0 1 auto; }
.nd-ledger-btn__count { flex: none; }
.nd-ledger-btn__q { min-width: 0; }
@media (min-width: 861px) { .nd-bar__book .nd-cta__free { display: none; } }
/* The client hid its five links below 1180 px; ours are seven, so they
   leave the bar below 1340, where the longest question would otherwise be
   cut. The question menu carries every page link. */
@media (min-width: 1181px) and (max-width: 1339px) { .nd-bar__nav { display: none; } }
/* The label every bag carries: HTML over the photo, never baked in. */
.nd-bag { container-type: inline-size; }
.nd-bag__label { position: absolute; left: 17%; right: 17%; top: 26%; bottom: 30%; background: #fff; color: #0C1211; border-radius: 6% / 4%; padding: 9% 8%; display: flex; flex-direction: column; gap: 4cqi; box-shadow: 0 1px 0 rgba(0,0,0,.05), 0 6px 16px rgba(0,0,0,.14); }
.nd-bag__mark b { font-size: 11cqi; }
.nd-bag__mark small { font-size: 2.6cqi; margin-top: 1.6cqi; }
.nd-bag__name { margin-top: auto; padding-top: 3cqi; border-top: 1px solid #D7DEDA; font: 600 8cqi/1.05 var(--sc-font-display); letter-spacing: -0.02em; }
.nd-bag__vol { font: 600 5.4cqi/1 var(--sc-font-text); letter-spacing: .04em; color: #46524F; }
.nd-foot__zones { grid-template-columns: 1fr 1fr; column-gap: 1rem; }
`
);

patch(
  "home.css",
  [
    [
      "/* ================================================================ HERO */",
      "/* NutriDrip v3 prototype: the client's home.css, patched where marked \"v3:\".\n   v3: act heights are reserved from first paint (.act-res) so the engine's own\n   write changes nothing; the artifact shifted the page by CLS 1.0 at load. */\n.act-res { height: calc(var(--span) * 100vh); }\n@media (max-width: 860px) { .act-res { height: calc(var(--span-m) * 100vh); } .formulary.act-res { height: auto; } }\n@media (prefers-reduced-motion: reduce) { .act-res { height: auto; } }\n\n/* ================================================================ HERO */",
    ],
    [
      ".hero__back { width: clamp(90px, 9vw, 150px); height: auto; max-width: none; filter: blur(5px) saturate(.9); opacity: .78; }\n.hero__back--1 { left: 37%; top: 9%; filter: blur(6px) hue-rotate(-28deg) saturate(1.05); }\n.hero__back--2 { right: 6%; top: 3%; width: clamp(80px, 7.5vw, 125px); filter: blur(7px) hue-rotate(115deg) saturate(.8); opacity: .65; }",
      "/* v3: the client's filters (blur, hue, saturation) baked into the images by tools/prepare.mjs, not run on a moving plane every frame. */\n.hero__back { width: clamp(90px, 9vw, 150px); height: auto; max-width: none; opacity: .78; }\n.hero__back--1 { left: 37%; top: 9%; }\n.hero__back--2 { right: 6%; top: 3%; width: clamp(80px, 7.5vw, 125px); opacity: .65; }",
    ],
    [
      ".hero__front { left: -3vw; bottom: -24vh; width: clamp(200px, 21vw, 360px); max-width: none; filter: blur(16px); opacity: .9; }",
      ".hero__front { left: -3vw; bottom: -24vh; width: clamp(200px, 21vw, 360px); max-width: none; opacity: .9; }",
    ],
    [
      "background: rgba(247, 248, 245, .72); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }",
      "background: rgba(247, 248, 245, .9); /* v3: solid plate, no backdrop blur */ }",
    ],
    [
      ".picker__grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: .75rem; }",
      ".picker__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: .75rem; } /* v3: six goals, 3 x 2 */",
    ],
  ],
  `
/* ================================================================ v3 BUILD FORMS */
/* Our own glass: the v2 cutouts with a blank label band, the name and dose in
   HTML. The client's branded vials printed doses our drips do not use. */
.vial { height: 15vh; min-width: 5.6rem; } /* the client's 5.2rem, a little more for our longer names */
.vial__glass { position: relative; height: 100%; }
.vial__glass img { height: 100%; width: auto; max-width: none; filter: none; }
.vial__label { position: absolute; left: var(--lx0); right: var(--lx1); top: var(--ly0); bottom: var(--ly1); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: .15em; text-align: center; color: #0C1211; font: 600 clamp(.42rem, .8vh, .62rem)/1.05 var(--sc-font-text); overflow: hidden; padding: 0 5%; }
.vial__label b { font: 700 1.05em/1 var(--sc-font-display); letter-spacing: -0.01em; }
.vial__label em { font-style: normal; font-weight: 500; opacity: .8; }
.vial > span { top: 103%; }
@media (max-width: 860px) { .vial { height: 9.5svh; } .vial__label { font-size: .36rem; } }
.nd-slip__body { margin-bottom: 1.2rem; }
/* v3d: the build's glass. The client's product photos where we stock that
   product; otherwise their amber ampoule with this ingredient's label set in
   their design. .vial__glass takes its width from its height and the photo's
   aspect, so the label can size itself in cqi of the glass. */
.vial { height: 15vh; }
.vial__glass { position: relative; height: 100%; container-type: inline-size; }
.vial__glass img { display: block; height: 100%; width: 100%; max-width: none; }
/* The label is laid out at the photograph's own width (196 px, where the
   real print lives) and scaled to the glass by page.js (--k), so it shrinks
   the way the print on the photographs does instead of meeting the
   browser's minimum font size. Label y 446-816 of the 900 px photograph. */
/* v3e: the print multiplies into the photograph's label, so the shading of
   the curved glass (darker toward each edge) runs through the ink and the
   band exactly as it does on the client's own photos. The content fills the
   label as theirs does: word, band, dose, then rule, ∞ and the route spread
   evenly to the bottom edge. */
.vlabel { position: absolute; left: 0; top: 49.6%; width: 196px; height: 370px; transform-origin: 0 0; transform: scale(var(--k, .15)); display: flex; flex-direction: column; align-items: center; text-align: center; color: #141816; padding: 17px 0 12px; mix-blend-mode: multiply; clip-path: inset(0 5px 0 5px); }
.vlabel__word { font: 800 36px/1 var(--sc-font-display); letter-spacing: -0.045em; }
.vlabel__word sup { font-size: .26em; font-weight: 600; vertical-align: top; position: relative; top: .15em; margin-left: .06em; letter-spacing: 0; }
.vlabel__sub { margin-top: 5px; font: 600 9.5px/1 var(--sc-font-text); letter-spacing: .13em; color: #26302D; white-space: nowrap; }
/* The label on the photograph spans x 4-191 of its 196 px, not the full
   width: the band ran 3-4 px past the glass on each side, ears on the dark
   ground (v3f). It now sits inside the label's edge, and the clip-path above
   keeps all print on the label. */
.vlabel__band { align-self: stretch; margin: 13px 5px 0; padding: 11px 0 10px; min-height: 86px; background: var(--band); display: grid; align-content: center; gap: 1px; color: #19202C; }
.vlabel__band b { display: block; width: max-content; margin-inline: auto; font: 800 var(--nfs, 24px)/1.06 var(--sc-font-display); letter-spacing: -0.012em; }
.vlabel__low { flex: 1; align-self: stretch; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding-top: 15px; }
.vlabel__dose { display: flex; flex-direction: column; align-items: center; gap: 6px; font: 700 29px/1 var(--sc-font-display); letter-spacing: -0.02em; }
.vlabel__dose small { font: 500 18px/1 var(--sc-font-text); letter-spacing: 0; color: #2A3230; }
.vlabel__rule { width: 72px; height: 3px; border-radius: 2px; background: var(--band); }
.vlabel__inf { width: 44px; height: auto; color: #1A1F1D; }
.vlabel__foot { font: 500 16px/1 var(--sc-font-text); color: #1E2422; }
/* The neck ring (rows 304-319, x 50-144 of the photograph), painted glass:
   lit in the middle, falling off round the curve. */
.vring { position: absolute; left: 25.5%; width: 48%; top: 33.78%; height: 1.78%; background: linear-gradient(90deg, color-mix(in oklab, var(--band) 62%, #000) 0%, var(--band) 20%, color-mix(in oklab, var(--band) 55%, #fff) 42%, var(--band) 68%, color-mix(in oklab, var(--band) 58%, #000) 100%); }
.vial > span { top: 103%; }
/* Phone: no captions (as the client), so each slot is just its glass, and the
   row stays inside the screen however many ingredients there are. */
@media (max-width: 860px) { .vial { height: 9.5svh; min-width: 0; } .build__vials { left: 0; right: 0; gap: .5rem; } }

/* v3d: the build bag's label, in the hero label's design. Sizes are cqi of
   the bag (.nd-bag is a size container), as on the hero. */
/* v3e: centred in the bag's clear body, which runs from 16.7% to 82% of the
   photograph's height (its welded seams above and below are opaque): about 3%
   of clear bag shows above the label and below it. It sat at 23-83%, on the
   bottom seam, with a gap over it.
   Four groups (wordmark, name band, doses, rule and volume) spread over
   the label, so it reads full like the client's labels instead of bunching at
   the top. Printed on the bag: a flat card with a soft edge and the bag's
   sheen across it, not a floating sticker. */
.build__label { left: 16.5%; right: 16.5%; top: 19.5%; bottom: 21%; padding: 8cqi 0 6.5cqi; border-radius: 4cqi; gap: 0; justify-content: space-between; color: #111514; overflow: hidden; background: linear-gradient(100deg, #F1F4F2 0%, #fff 16%, #fff 64%, #ECEFED 100%); box-shadow: 0 0 0 1px rgba(0,0,0,.05), 0 3px 10px rgba(0,0,0,.14); }
.build__label::after { content: ""; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(104deg, rgba(255,255,255,0) 36%, rgba(255,255,255,.26) 43%, rgba(255,255,255,0) 50%); mix-blend-mode: screen; }
.bl-head { padding: 0 7.5cqi; }
.build__label .bl-band { margin: 0; padding: 2.6cqi 7.5cqi 2.3cqi; border: 0; background: color-mix(in oklab, var(--tint) 30%, #fff); color: #141A26; font: 800 6.4cqi/1.05 var(--sc-font-display); letter-spacing: -0.012em; text-transform: uppercase; }
.build__label .build__lines { flex: none; margin: 0; padding: 0 7.5cqi; font: 500 3.3cqi/1.4 var(--sc-font-text); gap: .6cqi; }
.build__label .build__lines li { display: grid; grid-template-columns: auto 1fr auto; align-items: baseline; column-gap: 1.6cqi; }
.build__label .build__lines li::before { margin: 0; align-self: center; }
.build__label .build__lines li b { font-weight: 650; white-space: nowrap; }
.build__label .build__lines .build__lsep { display: block; margin-top: .8cqi; color: #46524F; font-size: .92em; }
.build__label .build__lines .build__lsep::before { background: transparent; border: 1px solid var(--tint); margin-right: 1.6cqi; }
.bl-end { display: grid; justify-items: center; gap: 3cqi; padding: 0 7.5cqi; }
.bl-rule { width: 28cqi; height: .7cqi; border-radius: 1cqi; background: color-mix(in oklab, var(--tint) 55%, #fff); }
.bl-word { margin: 0; font: 800 11.6cqi/1 var(--sc-font-display); letter-spacing: -0.045em; }
.bl-word sup { font-size: .3em; font-weight: 600; vertical-align: top; position: relative; top: .32em; margin-left: .05em; letter-spacing: 0; }
.bl-sub { margin: 2.4cqi 0 0; font: 600 1.95cqi/1 var(--sc-font-text); letter-spacing: .42em; color: #1D2422; white-space: nowrap; }
.bl-foot { margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; gap: 2.6cqi; height: 8cqi; }
.bl-foot svg { width: 11.5cqi; height: auto; display: block; }
.bl-foot i { width: .45cqi; min-width: 1px; align-self: stretch; background: currentColor; }
.bl-foot b { font: 650 4.1cqi/1 var(--sc-font-display); letter-spacing: -0.02em; }
@media (max-width: 860px) {
  .build__label { left: 14%; right: 14%; top: 19%; bottom: 20.5%; padding: 7cqi 0 5.5cqi; }
  .build__label .build__lines { font-size: 3.6cqi; }
}
/* v3c: the six steps. The client slid the whole row, number circle included,
   10px right while a step was off, so circles sat beside the line, and a
   circle turning on slid across the green line mid-turn. Now the circle never
   moves; only the text settles. Both lines run between circle centres,
   measured by page.js (--l0, --lh, --lp), so the green line always ends on a
   circle whatever each step's text wraps to. */
.path__steps li { transform: none; transition: color 260ms var(--sc-ease-out); }
.path__steps li > div { transform: translateX(10px); transition: transform 260ms var(--sc-ease-out); }
.path__steps li.is-on > div { transform: none; }
.path__n { transition: background-color 220ms var(--sc-ease-out), border-color 220ms var(--sc-ease-out), color 220ms var(--sc-ease-out); }
.path__steps::before, .path__steps::after { left: calc(1.15rem - 1px); top: var(--l0, 1.2rem); }
.path__steps::before { bottom: auto; height: var(--lh, calc(100% - 2.4rem)); }
.path__steps::after { height: var(--lp, 0px); transition: height 260ms var(--sc-ease-out); }
/* A short laptop screen: all six steps fit under the bar while pinned. */
@media (min-width: 861px) and (max-height: 820px) {
  .path__steps { gap: 0; }
  .path__steps li { padding: .45rem 0; }
  .path__steps b { font-size: 1.06rem; }
  .path__steps p { font-size: .9rem; line-height: 1.45; margin-top: .1rem; }
}
/* A short phone (iPhone SE and smaller): the same, one step further. */
@media (max-width: 860px) and (max-height: 720px) {
  .path__steps li { padding: .2rem 0; }
  .path__steps p { font-size: .8rem; line-height: 1.35; }
  .path__steps b { font-size: .95rem; }
}
@media (prefers-reduced-motion: reduce) { .path__steps li > div { transform: none; } .path__steps::after { transition: none; } }
/* The hero bag's label: the client's print, set in HTML over the photograph's
   blank card (bag-hero-clean.webp). Positions are fractions of the 611 x 1400
   photograph, so the print scales with the bag. */
.hero__bag { container-type: inline-size; }
.hb-label { position: absolute; inset: 0; pointer-events: none; color: #111514; }
.hb-word { position: absolute; left: 27.2%; top: 31.35%; font: 800 11.7cqi/1 var(--sc-font-display); letter-spacing: -0.045em; }
/* v3e: the ™ as the header logo sets it (top-aligned, a touch smaller), so the
   bag reads as the logo; the client's print had one too small to see. */
.hb-word sup { font-size: .3em; font-weight: 600; letter-spacing: 0; vertical-align: top; position: relative; top: .32em; margin-left: .05em; }
.hb-sub { position: absolute; left: 27.5%; top: 36.75%; font: 600 1.95cqi/1 var(--sc-font-text); letter-spacing: .435em; color: #111514; white-space: nowrap; }
.hb-foot { position: absolute; left: 35.9%; top: 75.07%; height: 3.14%; display: flex; align-items: center; gap: 2.5cqi; }
.hb-foot svg { width: 12.1cqi; height: auto; display: block; }
.hb-foot i { width: .45cqi; min-width: 1px; align-self: stretch; background: currentColor; }
.hb-foot b { font: 650 4.1cqi/1 var(--sc-font-display); letter-spacing: -0.02em; }
/* v3e: the formulary card head. The badge sat in the price row, wrapped to
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
.liq__wave { position: absolute; left: 0; right: 0; bottom: calc(100% - 1px); height: 6cqi; overflow: hidden; transform-origin: 50% 100%; transform: scaleY(.22); opacity: 0; }
.liq__wave--back { height: 8.5cqi; }
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
/* v3e: page.js fades the steps out before the closing card where the two
   would meet (short screens). */
.build__steps { opacity: var(--steps-o, 1); }
.is-static .build__steps { opacity: 1; }
/* v3e: the hero bag's print plane: the bag's box, without the photo's
   shadow and without will-change, so its text is redrawn sharp at any scale. */
.hero__bag.hero__bagprint { filter: none; will-change: auto; pointer-events: none; }
/* v3e: the picker's colour dot sits in the card's corner; our titles are
   longer than the client's and ran under it ("Before travel, afte●"). The
   title keeps clear of the dot; the line under it still uses the full card. */
.feel { padding-right: 2.6rem; }
.feel small { margin-right: -1.45rem; }
@media (max-width: 860px) { .feel { padding-right: 2.2rem; } .feel small { margin-right: -1.3rem; } }
/* v3e: a tablet (600-860 px) stacks the formulary like a phone, but one card
   720 px wide left its content in the left third. Two cards to a row there;
   the lead and the close keep the full width. */
@media (min-width: 600px) and (max-width: 860px) {
  .formulary__rail { grid-template-columns: 1fr 1fr; align-items: stretch; }
  .formulary__lead, .formulary__end { grid-column: 1 / -1; }
}
/* The time column only where it fits; every card above already shows it. */
@media (max-width: 520px) { .cost__table th:nth-child(2), .cost__table td:nth-child(2) { display: none; } }
`
);
console.log("patched site.css and home.css");
// v3b: the baked hero planes carry 50 px of margin around a 279 px bag
// (x 379/279 = 1.3584, pulled back by 50/279 = 0.1792 of the original width).
{
  const f = path.join(ROOT, "home.css");
  fs.appendFileSync(
    f,
    `
.hero__back--1 { width: calc(clamp(90px, 9vw, 150px) * 1.3584); margin: calc(clamp(90px, 9vw, 150px) * -0.1792) 0 0 calc(clamp(90px, 9vw, 150px) * -0.1792); }
.hero__back--2 { width: calc(clamp(80px, 7.5vw, 125px) * 1.3584); margin: calc(clamp(80px, 7.5vw, 125px) * -0.1792) calc(clamp(80px, 7.5vw, 125px) * -0.1792) 0 0; }
.hero__front { width: calc(clamp(200px, 21vw, 360px) * 1.3584); margin: 0 0 calc(clamp(200px, 21vw, 360px) * -0.1792) calc(clamp(200px, 21vw, 360px) * -0.1792); }
@media (max-width: 860px) {
  .hero__back--1 { width: calc(70px * 1.3584); margin: calc(70px * -0.1792) 0 0 calc(70px * -0.1792); }
  .hero__front { width: calc(46vw * 1.3584); margin: 0 calc(46vw * -0.1792) calc(46vw * -0.1792) 0; }
}
`
  );
}
