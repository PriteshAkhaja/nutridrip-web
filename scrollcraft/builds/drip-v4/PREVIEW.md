# Review copy, not live

The client's 2026-11-20 build stage runs at **/drips/<slug>/preview** (noindex). `/drips/<slug>` is unchanged.

Preview-only files: `DripPageV4.tsx`, `DripMotionV4.tsx`, `motion-v4.ts`, `BuildStage.tsx`, `build.ts`, `build-math.ts`, `styles/drip-build.css` (scoped by `npm run site-css`), `app/(site)/drips/[slug]/preview/page.tsx`.

To go live once approved: point `drips/[slug]/page.tsx` at `DripPageV4`, import `drip-build.css`, delete the preview route and the old hero-bag / companion code, then update AGENTS.md (the /drips/[slug] row) and append to `_reference/CLIENT-CHANGES.md`.

Revision 2 (user, 2026-11-20): the merge happens in the TOP section itself (no new section below), with the ingredients floating in a vertical column on the left.

Revision 3 (user, 2026-11-20): use the empty space on both sides; the RIGHT column scrolls as the page always did and only the LEFT (floating bottles + bag) stays.
- Layout: left shelf (floating bottles, 2 staggered columns from 3 bottles up) + bag stay pinned; the right column (hero, then "What's inside" rows) is moved up one-for-one with the scroll (`build.ts`: translate = -y). Each row owns the scroll around the moment it crosses mid-screen (`scrollTimeline`), and its bottle pours then.
- Bottle path: it tips (100 deg) and shrinks to 0.78 so its neck sits at the bag's top (`pourAim`); it no longer flies up behind the header and no longer sinks into the bag as a ghost.
- A bottle that is "given beside the bag" stays on its shelf with its caption (it no longer moves onto the bag's edge).
- Section height is set by the script from the measured column; the still version (reduced motion, short screens) is unchanged: bag, hero, list, then the two pictures.

Revision 4 (user, 2026-11-20): reload flicker, too much gap, dotted outlines.
- No flicker: an inline script right after the section adds `is-pinned` while the HTML is read, so the first paint is already the pinned layout (checked with the app's JS blocked). Before the script measures, the height is an estimate, `--u` = 3.13 + 0.223 x (rows - 1) screens, fitted to the measured stage.
- Rows are closer (11svh apart; 5svh on a phone). A bottle still gets at least half a screen of scroll: its move span overlaps its neighbours' (`moves` in `scrollTimeline`), while the list lights one row at a time.
- The dashed outlines where a bottle stood are gone.
- The column stops once its last row reaches the focus line, so the list never scrolls away into an empty window before the stand scene.

Revision 5 (user, 2026-11-20): "I like this one better" (the ORIGINAL page): use it, with small ingredient bottles, and make sure it holds with many ingredients.
- The preview is now the original page (DripPage.tsx: hero and list scrolling normally, the bag sticky on the left, read rows staying tinted, "N of M read") with:
  - a shelf of small floating bottles left of the bag (one column; two past six; on a phone, rows of four above the bag). As each row rises past the reading line its bottle tips into the bag (`readT`, `bottlePose`, `pourAim` in build-math.ts), the liquid rises and the label prints the line. Pure functions of the row's place, so scrolling back undoes it. What is given beside the bag stays on the shelf, captioned.
  - after "What's inside", the stand scene (StandStage.tsx, stand.ts, `standPhase`): the drip's full bag comes down onto the hook and swings to rest, the evening words, then the morning with the drip's benefits ("What it's for" moved here). Pinned from the first paint by an inline script.
  - the rest of the page in one column (dp__after).
- Removed: the pinned build stage (BuildStage.tsx, build.ts).
- Files now: DripPageV4.tsx, DripMotionV4.tsx, motion-v4.ts, StandStage.tsx, stand.ts, build-math.ts, styles/drip-build.css.

Revision 6 (user, 2026-11-20): "not looks good, one item at a time".
- Bottles now go in strictly one at a time: a row being read queues its bottle (`stepQueue` in build-math.ts); each takes about a second to tip and pour (the carrier half that); with a backlog the queue runs 1.8x faster, so a fast scroll is never far behind. Read back up and they come out, last first. Checked by fast-scrolling past every row: never more than one bottle in the air (Hydrate Plus, Myers' Revive).
- Room under the list (inside the row the bag is sticky in) keeps the bag in place until the last bottle is in; then the stand comes up.
- The "beside the bag" bottle lifts slightly when its row is read.

Revision 7 (user, 2026-11-20): "not in one line"; "same drip attach to the stand with scroll".
- The shelf is a loose cluster: two staggered columns (the second half a bottle lower), each bottle at its own slight tilt, still floating; a zig-zag row on a phone.
- The same bag goes onto the stand: the scene sits a screen up, over the end of the list (margin-top: -100svh, transparent and untouchable until it starts). As it starts, the room fades in around the full bag, which stays where it was; the page's bag is hidden and a copy drawn exactly over it (same ring, same scale) travels on to the hook, rising a little, and swings to rest. Scroll back up and the page's bag is back (`standPhase`: room, fly, sway, a2, bag, feel, a3).
- More room under the list (95svh; 80svh on a phone) so the last bottle is in and the bag is full before the hand-over.

Revision 8 (user, 2026-11-20): "what is Beside the bag / 4 of 4 read"; "the bag goes up too late"; "use the left and right space, more gap".
- The "Beside the bag" caption is gone (the list row already says "Given separately... Never mixed into the bag"); that bottle still stays on the shelf.
- The read count ("N of M read", from the original page) stays beside the bag while reading, and fades with the leftover bottle as the room comes up, faster than the room, so nothing shows through it.
- The room under the list is 32svh (26svh on a phone), so the bag sets off for the stand just after the last bottle.
- Desktop: the page's container is 112rem (was 78rem), columns 1fr / 1.1fr, gap up to 9rem, reading column max 50rem.

Revision 9 (user, 2026-11-20): "remove the 4 of 4 read counter; scroll it yourself, take screenshots, find the issues".
- Counter removed.
- Self-check by wheel-scrolling (tools/walk.mjs, 1440 desktop and 390 phone) found and fixed:
  - the given-separately bottle sat alone on the shelf: it now takes its turn in the queue and fades where it stands (`sepPose`) as the label prints "Given separately";
  - the list's text showed through the room as it came up: the list now fades with the shelf, faster than the room;
  - on a phone, fast reading left bottles mid-pour when the bag left: the backlog now catches up faster (`queueSpeed`, up to 3.2x), the room under the list is 44svh on a phone, and the stand's bag takes the page bag's live level and keeps filling, so it is never shown fuller than it is.

Revision 10 (user, 2026-11-20): step 3 "the patient feels energised", with a nurse at home, generated pictures, one per goal, no "Illustration" note.
- Pictures (KIE Seedream 5 pro image-to-image, 14 credits each, 70 spent; prompts and originals in gen/): evening.webp (patient on the sofa with a cannula, nurse in plain scrubs and gloves taking his BP, stand empty), and the morning after per goal: energy, hydration, immunity, skin. Athletic recovery and Post-viral fall back to Energy until the top-up. Each looked at before use: same man throughout, no text or logos, natural hands.
- The scene (StandStage, stand.ts, standPhase): the room and the bag onto its stand; a cut to the evening with the nurse, the bag moving onto that picture's hook (lib/feel CARE: hook, pole, cannula, scale); a tube draws from the bag's port to the cannula, a drop falls in the chamber, the bag drains, and the clock runs from the evening slot over the drip's own duration (server-side, every 5 minutes, in the site's clock format) with "{duration} at home, observed every 10 minutes." (the session section's own words); then the morning with the drip's benefits.

Revision 11 (user, 2026-11-20): no empty evening room; the bag goes straight to the stand beside the patient.
- The room picture and its step are gone. As the list ends, the evening with the nurse comes up around the full bag, the same bag flies onto that picture's stand and swings to rest, "At your home / 7:00 PM / a nurse at your door…" comes in top left over the dark wall; then the tube, the drip running with the clock; then the morning. Scene length 4.6 screens (2.8 without a morning). Still version: the nurse picture with the arrival words, then the morning.
- Ingredient rows: every row a card (white until read, then the drip's tint and border, a soft shadow), 0.6rem apart (0.5rem on a phone).
- The quiz note under the morning's button is light on the photograph.

Revision 12 (user, 2026-11-20): the bag flew across the nurse and the patient's face, and the list showed through the scene. Now the list and shelf clear first (page), the bag crosses the plain page to the stand's place, and the scene fades in around it as it arrives (room), so nothing passes over the people.

Revision 13 (2026-11-20, from the user's screenshots): no blank pale stretch or foggy fade. As the list clears the screen dims to the evening (st__night, opacity = page); the bag crosses the dark; the room lights up around it on the stand; the arrival words come in sooner. Arrival takes 24% of the scene (was 30%).

Revision 14 (user, 2026-11-20): the bag hung below the hook, not on it. Measured the hole (centre 0.499 x 0.0465 of the bag picture; RING now its inner top, 0.499 x 0.034) and set the hook from the render (CARE.hook 1655, 179); a short wire (st__wire, bag-picture units) is drawn through the hole once the bag is hung, so it reads as threaded on the hook.

Revision 15 (user, 2026-11-20): the list clears 3.5x faster than the screen darkens (no half-grey frame); the room starts lighting as soon as the bag is past the nurse (e 0.28, was 0.35), so the dark stretch is about half as long; the arrival words come in sooner (e 0.55-0.8).

Revision 16 (user, 2026-11-20): "why 7:00 go and come back": the arrival words and the running clock are now one block. The time stays on screen and starts to run; only the tag (At your home -> While it runs) and the line under it change in place, the old out before the new in.

Revision 17 (self-check, 2026-11-20): full wheel walks (1920x920 Hydrate Plus, 390 Myers' Revive). Fixed the evening-to-morning double exposure: the evening goes dark first (m 0-0.2), the morning comes up out of the dark (m 0.22-0.52), its words after (m 0.42+). Scroll budget at 1920x920 (100 px notches): ingredients ~4-8, hand-off ~6, arrival ~4, drip running ~12, morning ~10.

Revision 18 (user, 2026-11-20): "what if the dark part stops after scroll": the dark between evening and morning carries "The next morning" (centred, m 0.08-0.5), so wherever the reader stops there is something on screen; a test checks no point of the scene is empty.

Revision 19 (user, 2026-11-20): no "The next morning" text. The evening now never goes dark: the bag and tube are taken down first (m 0-0.15; the drip is over), then the evening dissolves into the morning (m 0.1-0.48), a whole picture at every scroll position. (A sunrise wipe was tried and dropped: it cut through the people's faces.)

Revision 20 (user, 2026-11-20): "same for this": no dark dip at the hand-off either. The list clears as the bag sets off and the page dissolves straight into the evening with the nurse (room e 0.08-0.46) around the travelling bag. The dark layer (st__night) is removed.

Revision 21 (user, 2026-11-20): "scrolling finishes too fast": the stand scene is 50% longer (--st-u 7 with the morning, 4.2 without; was 4.6 / 2.8), every part in proportion. At 1920x920 with 100 px notches: bag to the stand ~9, arrival ~6, drip running ~18, morning ~15.

Revision 22 (user, 2026-11-20): v2's move. The bag stays still while the evening room with the nurse slides up from below the screen like the next page (care translateY), pushing the list and shelf up and away; once the room is in place the bag shrinks and rises first, then goes across to the hook (y and scale lead, x follows), and swings to rest.

Revision 23 (user, 2026-11-20): "check version 2 properly": v2 (nutridrip-liked home page, scroll/assembly.ts) drives the room and the bag with one progress ("ground"): the room translates up from 100% while the bag lerps in a straight line, shrinking, to its hung place; both arrive together. Now the same: fly = room = page, straight lerp of x, y and scale.

Revision 24 (user, 2026-11-20): "when the last ingredient goes in, start the move on the next scroll": the room under the list is no longer fixed; stand.ts sets it from the last row (fitHandOff) so the scene starts one wheel notch after the last row passes the reading line. Measured: exactly 1 notch later on Hydrate Plus and Myers' Revive at 1920x920, 1440x900 and 390x844.

Revision 25 (user, 2026-11-20): "why does the bag hide before the energy screen": it no longer goes first. The whole evening (room, bag on its stand, tube, the 7:40 PM words) dissolves into the morning together (bag = a2 fade = 1 - feel, feel m 0.05-0.45).

Revision 26 (user, 2026-11-20): the list holds: once its last card's foot reaches the foot of the screen, the reading column is moved down by as much as the page scrolls on (CSS translate; motion-v4 measureHold/applyHold) and rows are read as if it kept scrolling, so the remaining bottles go in with the list in view. One notch after the last row, the room slides up and pushes the list away, fading it (stand.ts clear), so the travelling bag never crosses its words.

Revision 27 (user, 2026-11-21): "right side flickering": the hold of revision 26 moved the list from script, a frame after the browser had scrolled it, so it shook on every notch. Now CSS sticky (.dp__hold, top set once per resize to put the last card's foot at max(32px, 6svh) above the screen's), held by the browser in the same frame. The room under the list is an element (.dp__room) rather than padding, since a sticky box only travels inside its parent's content; stand.ts sizes it and runs it 1.5 screens on under the scene (cancelled by a negative margin), so the list stays held while the room pushes it away. Rows are read from their layout positions. The hand-off gap is now exactly one 100 px notch (was 110, which sometimes landed two later), and the room starts at the scene's first pixel at about scroll speed (x + x^2 - x^3, easing out onto the hook). Measured: scene on the notch after the last row at 1920x920, 1440x900 (Myers' Revive) and 390x844.

Revision 28 (user, 2026-11-21): the Hydration morning picture crops from its top ("66% 0%"), so his head clears the header on a wide screen. And a pour still going when the stand scene starts (a scroll faster than the 1.1 s pours) finishes 8 times faster (motion-v4 hurry, while the scene's top is above the screen) instead of being carried off mid-air with the shelf. Measured on Myers' Revive at 1920x920: at a notch every 250 ms the last bottle is in within 200 ms of the scene starting; at one every 60 ms five are left and all are in within about 400 ms.

Revision 29 (user, 2026-11-21): "on refresh the ingredient labels flicker": each bottle's label is laid out at 196 px and scaled to its glass by scaleLabels (--k), which only runs with the script; until then every label sat at the 0.15 fallback, so the vials' grew about 40% and the ampoules' shrank 20% after load. Now drip-build.css works the same scale out in CSS from the shelf's glass height (--rk-h) and the glass's width over height (--gar, written by glassHTML): calc(tan(atan2(var(--rk-h), 196px)) * var(--gar)). Measured on Myers' Revive at 1920x920 and 390x844: first paint (no script) and scripted scale agree to 0.0001 on every label.

Revision 30 (user, 2026-11-21): "the label text flickers on refresh": each bottle's band text started at the 24 px fallback until fitBands measured it after load (up to 34 px). glassHTML now prints each band at the size fitBands will set, from a table of Outfit 800's character widths at 100 px (glass.ts BAND_W, measured by tools/band-widths.mjs; within about 1% of the real lines). Measured on Myers' Revive and Hydrate Plus: server and fitted sizes differ by at most 0.3 px at label size (about 0.04 px on screen). A frame-by-frame refresh (tools/refresh-frames.mjs, png-diff.mjs) now changes only by the dev server's own badge and sub-pixel antialiasing.

Revision 31 (user, 2026-11-21): phone check of the bottles. Labels and bands: first paint and scripted agree at 390x844 on Myers' Revive and Hydrate Plus (scale to 0.0001, bands within 0.3 px at label size), and every name sits inside its band. A full-width refresh diff then found the page text redrawn with different smoothing as the script started: the reading column became sticky (its own layer) only then. It is now sticky from the first paint in drip-build.css (top -100000px, until motion-v4 sets the real one; not under reduced motion). After: changed pixels on refresh 18,096 -> 1,383 on a phone, almost all the dev server's badge; none in the text column on a desktop.

Revision 32 (user, 2026-11-21): the other morning pictures checked for cut-off heads. The morning now starts below the header (.st.is-pinned .st__feel top: var(--bar-h); the header is 97% opaque, so nothing under it showed anyway), and each picture's position keeps its head or raised hands clear: Energy 66% 0% (hands near the top edge), Hydration 66% 0%, Immunity 70% 25%, Skin 66% 15%. Checked on a contact sheet (tools/morning-sheet.mjs) at 1920x920, 2560x1080, 1440x900 and 390x844 for Myers' Revive, Hydrate Plus, Immune Shield and Glow Protocol: every head clear of the header, Energy's hands whole on a desktop; on a phone the faces are in, only the outer hand / bottle reach past the side.

Revision 33 (user, 2026-11-21): the merge, improved (the user picked 1 and 2 of four suggestions). (2) Each bottle now enters by the bag's medication port, not the hole it hangs from: it travels (leaning into the way it goes, dipping so it comes up from below), docks upright under the left port (build-math PORT 0.331 x 0.888; the long centre port is the giving set's) and shrinks into the port's end from its neck (transform-origin 50% 0), while a ring in its band colour closes around the port (portRing, scroll-driven, so reading back opens it). (1) As it goes in, its colour blooms up into the liquid: three clouds in the band colour, richer (oklch relative colour, chroma x2.2-2.4; plain band colour where unsupported), laid over the liquid (not multiplied: a yellow in a lilac bag went to mud), rising and swirling each its own way and thinning out over 2.2 s (bloomPose, BLOOM_MS; timed, forwards only), kept under the surface by a clip-path liquid.ts writes. Drops from the top of the bag are gone on this page (LiquidFill drops 0; the landing keeps its own). Checked frame by frame at 1920x920 (vitamin C: a golden cloud; magnesium: sky blue) and 390x844 (ring sized to the phone's bag). Tests: 34 in drip-build-math (port entry, ring, bloom); 825 in all.

Decision (user, 2026-11-21): keep the entry by the medication port at the foot of the bag (realistic for a clinical brand), not the pour through the hanging hole.

Revision 34 (user, 2026-11-21): the bottle's cue on the shelf before its turn. As its row comes within an eighth of a screen of the reading line (less than the rows' spacing, so one bottle at a time), its bottle rises 9 px, grows 5% and a soft halo in its band colour comes up behind it (build-math shelfCue, CUE_LIFT; bottlePose's cue; .dp__rb::before, opacity only). Scroll-driven, so it eases back if you scroll up; a bottle waiting in the queue stays lifted; the lift carries into its way to the port and is gone by the time it docks (tests: no jump, none left at the port). Checked at 1920x920 and 390x844 on Myers' Revive. 827 tests.

Revision 35 (user, 2026-11-21): the entry a bit slower. A bottle's turn is 1.5 s (was 1.1): about half a second on its way (go 0.1-0.45), a beat docked (to 0.52) and half a second going in (into 0.52-0.86, was about a quarter of a second); the ring follows (show 0.4-0.52, closes 0.45-0.86). Trade-off measured: at a notch every 250 ms, three bottles are still to go in when the stand scene starts (was one); the scene's hurry takes them in within 400 ms. At an ordinary reading pace each goes in at its own speed. 828 tests.

Revision 36 (user, 2026-11-21): tested with a quick scroll myself (tools/quick-scroll.mjs: a wheel notch every 70 ms down into the stand scene and back up, checked every notch). Myers' Revive at 1920x920 and 390x844, Hydrate Plus at 1440x900: never more than one bottle moving; every bottle in and every label line printed at the end; scrolling back up brings them out one at a time and leaves the shelf full and the label empty. Two fixes: (1) a bottle still going in as the scene starts left the port's ring floating where the bag had been (the ring sits beside the page's bag, which hands over): the ring now hides once the scene is under way. (2) On a phone a bottle on the top row, at the top of its float and lifted by its cue, reached under the header: the phone's shelf and bag sit 16 px lower (rig padding and rack top), the top row now 25 px under the header at rest, about 7 px clear at its highest. At that speed on a phone the scene can start with up to four bottles still to go; they go in within about half a second.

Decision (user, 2026-11-21): no scroll-jacking for the ingredients. One notch reads one row and sends its bottle in at a normal pace; a fast scroll queues the bottles and they catch up (the queue speeds up, and the stand scene hurries any left). Considered and declined: holding the page while each bottle goes in (one gesture, one ingredient), unreliable on trackpads, phones, the scrollbar and the keyboard.

Decision (user, 2026-11-23): review final, live. /drips/[slug] now renders this page (DripPage, DripMotion, motion.ts: the V4 files renamed into place; the original page's DripPage, DripMotion and motion.ts removed); the preview route is gone. AGENTS.md's Companion row and _reference/CLIENT-CHANGES.md (68) updated.

Speed, 2026-11-23 (tools/vitals.mjs, cold cache, intro seen; LCP ms / CLS at load / CLS after scrolling 30 notches):
- Production (next start): Myers' Revive 1440 480–828 / 0 / 0, 390 404–412 / 0 / 0; Hydrate Plus 1440 440–628 / 0.008 / 0.008, 390 364–392 / 0 / 0; home 1440 568–620 / 0 / 0.001, 390 468–544 / 0 / 0; Drips 1440 320–324, 390 256–284, CLS 0. LCP element on the drip pages: the bag photograph.
- Dev: the same CLS; LCP 0.8–1.8 s, all of it the dev server's slower first byte (0.5–1 s against 0.04–0.19 s).
- The 0.008: on a drip with a short list the stand scene's top edge shows at the foot of the first screen and moves up 49 px once fitHandOff sizes the room (tools/shift-src.mjs). Left as is.
