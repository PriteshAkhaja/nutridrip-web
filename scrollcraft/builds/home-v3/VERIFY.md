# v3 landing prototype: assets and verification (2026-10-30)

The client's layout and motion (`_reference/NutriDrip IV Nutrient Therapy/`),
filled from our data. The decisions are in
`scrollcraft/lab/client-artifact/REVIEW.md` §5 and §7.

Rebuild:
- `node scrollcraft/builds/home-v3/tools/export-drips.mjs` (read-only)
- `node scrollcraft/builds/home-v3/tools/prepare.mjs`
- `node scrollcraft/builds/home-v3/tools/patch-css.cjs`
- `node scrollcraft/builds/home-v3/tools/render.mjs`

## Assets

| File | Source | Note |
|---|---|---|
| `fonts/outfit-*`, `fonts/geist-*` | Client artifact | SIL OFL 1.1 (`fonts/OFL-*.txt`), commercial use allowed |
| `assets/room*.webp`, `prep*.webp`, `tablets.webp`, `ivline.webp`, `bag-empty.webp`, `bag-mask.png` | Client artifact | Clean plates, no baked text |
| `assets/chamber.mp4`, `chamber-poster*.webp` | Client artifact | Cleared for use by the user ("not copyrighted"). No watermark |
| `assets/chamber.webp` | Frame 72 of `chamber.mp4` | First frame with no drop at the nozzle |
| `assets/bag-blur-*.webp` | `prepare.mjs` | Client bag, palette tint inside its mask, blur baked in |
| `assets/vial*.webp`, `ampoule*.webp` | Our v2 cutouts (`builds/home-v2`) | Blank label band; name and dose are HTML |
| **Not used** | Client `vial-*.webp`, `carton-*.webp`, `bag-hero*.webp` | They print text into the image: "500 mL", and doses like "VITAMIN C 1500 mg" that our drips do not use |

## Checks on the final files

| Check | Desktop 1440×900 | Phone 390×844 | Reduced motion |
|---|---|---|---|
| `shoot.mjs` (dead scroll, cue peaks, contrast) | pass, 37 frames | pass, 37 frames | pass, 35 frames |
| Console errors / failed requests | 0 / 0 | 0 / 0 | 0 / 0 |
| CLS on load / after a full scroll | **0** / 0.002 (artifact: 1.0) | 0 / 0.001 | — |
| LCP | 784–1,068 ms | 1,260 ms at 4× CPU | — |
| Keyboard: tab stops not visible when focused | 0 of 60 (artifact: 12+) | 0 of 54 | — |
| `backdrop-filter` / CSS blur on moving or sticky layers | none (artifact: header, hero cards, 3 bag planes) | none | — |

Fixed during the pass:
- step 1 of the build split into a column (inline spans inside a grid item)
- drip-card links focused off-screen in the transformed rail
- the build's closing links focused at opacity 0
- the drop too small to read, solved with a scroll-driven push-in on the nozzle
- the price table's time column cramped at 390 px

## Not verified

- **A real phone** (iOS touch scrolling).
- **The real header and footer.** These are stand-ins for the restyled
  `SiteChrome`.
- **Widths 768, 1024 and 1920.** The skill requires them after the port.
- **The route itself.** Dev and production LCP/CLS come with the port. Port
  3000 currently serves a different project, not NutriDrip.

## v3b: after user review (2026-10-30)

| Change | How |
|---|---|
| The drop | Back to the client's `chamber.mp4` scrubbed by scroll: their markup, `chamber-m.mp4` on phones, the webm fallback. The code-drawn drop is removed. |
| Hero bag | The client's photograph (`bag-hero.webp`) with its print lifted off (`tools/clean-hero-bag.mjs`), and the same words set in HTML. Measured against the original print at 611×1400, every element lands within 1–2 px. |
| Hero blurred planes | The client's exact filters (blur, hue-rotate, saturate), baked by `tools/prepare.mjs`. |
| Build | Vial captions widened to the client's minimum, so six names no longer collide. |
| Phone header | The bar's button is hidden on phones, as in the client's version; the sticky bottom bar carries the quiz. |

**Side by side**, aligned by section, client on the left:
- desktop: `lab/sbs-desk/sbs-1..5.jpg`
- phone: `lab/sbs-m/sbs-1..7.jpg`

**Final checks:**

| Check | Desktop | Phone | Reduced motion |
|---|---|---|---|
| `shoot.mjs` (incl. frozen-clip check on the scrubbed video) | pass, 43 frames | pass, 43 frames | pass, 35 frames |
| Console errors / failed requests | 0 / 0 | 0 / 0 | 0 / 0 |
| CLS on load | 0 | 0 | — |
| LCP | 644 ms | 1,504 ms at 4× CPU (the hero photo) | — |
| Keyboard | 60 stops, all visible | — | — |

## v3c and v3d: after user review (2026-10-30)

**Six steps.** The circles stay on the line, and only the text slides in. The
grey and green lines are measured between circle centres; the green line
ends on each circle's centre at 920×682, 1440×900 and 390×667. On short
screens the list goes compact, so all six steps fit under the bar.

**Build glass.** The client's product photographs are used for Vitamin C,
Vitamin B Complex, Magnesium Sulfate and Calcium Gluconate, matched by
ingredient name. Every other ingredient gets the client's amber ampoule with
its print lifted off (`tools/blank-ampoule.mjs`), labelled in HTML in their
design: wordmark, coloured band with the name, the drip's dose, ∞ and "For IV
Use Only". The client's B12 photo is methylcobalamin, so it is not used for
cyanocobalamin.

**Fill.** The bag rises one step per ingredient as it enters. The act's span
is 3.2 + 0.3 per bag ingredient, between 4 and 6 screens (5.0 for Myers'
Revive). Measured on Myers' Revive: 0.17, 0.33, 0.50, 0.67, 0.83, 1.00 at
evenly spaced scroll.

**Build label.** The hero label's design (wordmark™, IV NUTRIENT THERAPY,
∞ | 500 mL), with the drip name and doses between.

**Units.** Volumes are written mL, as on the client's labels.

**Checks.** `shoot.mjs` passes at 1440×900, 390×844, reduced motion and
920×682, with 0 console errors and 0 failed requests. The phone vial row fits
the screen: six vials at x 110–280 of 390.

## v3e: after user review (2026-10-30)

| Change | How |
|---|---|
| Fill | The scroll sets the target level; each frame eases a tenth of the way to it. Each ingredient pours over 90% of its slice, eased in and out, so pours run into each other. Two rolling waves make the surface, with a white meniscus line. Drops fall while the level rises; each one rings the surface and rocks it, and the rocking settles by itself. Through a 60 px-per-frame wheel the level never moves backwards, and its largest step is 18 px. |
| Ampoule labels | The print multiplies into the photograph's own label, so the curved glass's shading runs through the ink. The band fits its widest line to 172 of 196 px: up to 34 px for one line, 30 for two. "(B12)" and "(B6)" come from the master's molecule; "(1 mg)" is derived from the dose. A neck ring in the band colour. No two glasses in one drip share a colour. |
| Bag label | Centred in the bag's clear body (16.7%–82% of the photo): 17 and 18 px clear above and below at 1440, 12 and 13 at 390. The name sits on a band in the drip's colour. Doses are in two columns. Wordmark, band, doses and volume are spread evenly. |
| Hero wordmark | The wordmark was blurred: live text in a plane rasterised once (`will-change`), then moved fractionally and scaled. The print is now its own plane with no `will-change`, at the bag's exact transform, snapped to device pixels. It stays sharp at scale 1.045. The bag matches the client's size and motion (360×825 at hero 0.3). The ™ is set as in the header logo. |
| Formulary cards | Titles and prices line up across the rail (titles at 67–69 px; the spread is the entry tilt). The badge sits in the card's corner. From 600 to 860 px, two cards to a row. |
| Picker | Titles keep clear of the colour dot: 0 collisions at 390, 768 and 1440. |
| Build, 1024×768 | The closing card landed on step 4. Where they would meet, the steps now leave first. |
| Build, phone | The label leaves before the closing card arrives, so the two never cross-fade. |
| Nav | "IV vs Tablets" added to the header, menu and footer. Links never wrap. From 1181 to 1380 px the note beside the quiz button steps aside. One line at every width, with at least 20 px to spare. |

**Audit, every frame at 390, 768, 1024, 1440 and 1920** (`scratchpad/audit.mjs`)
- 0 horizontal overflow, 0 console errors.
- No text under the header in a pinned stage.
- What remains flagged is by design: the phone's sticky bar over content, the drip rail mid-pan, and closed FAQ answers that report boxes while clipped.

**Checks**
- `shoot.mjs`, 0 console errors and 0 failed requests at every setting:
  - pass, 79 frames, desktop
  - pass, 43 frames, 390×844
  - pass, 35 frames, reduced motion
  - pass, 43 frames, 920×682
- LCP 576 ms desktop; 1,708 ms on a phone at 4× CPU.
- CLS 0 on load.
- 62 keyboard stops, all visible.

**Open**
- The client's product photos print figures our drips and stock do not use:
  - Vitamin C photo: "1500 mg" and "IMMUNITY / ANTIOXIDANT / REJUVENATE". Our vials are 5,000 mg; the drips use 1,000–15,000 mg.
  - Magnesium photo: "5,000 mg". Our dose is 1,000 mg.
  - Calcium photo: "1,000 mg". Our dose is 500 mg.

## v3f: the header with long questions (2026-10-31, user review)

- **Bug.** The question button grows with the current question. On the long ones ("What if it's not right for me?") the row ran out of room, the logo's tagline broke onto two lines, and the note beside the quiz button wrapped to four lines, out of the bar. The earlier check measured only the first label, "What is this?".
- **Fix (`site.css`, shared chrome).**
  - The logo, the links and the buttons never shrink. Only the question may shorten, with its full text in the button's title.
  - The quiz note is dropped on desktop.
  - The seven links leave the bar below 1340 px. The client hid its five below 1180. The question menu carries every page link, Pricing now included.
- These rules sat in `home.css` by mistake. They are now in `site.css`, which is copied to `builds/iv-vs-tablets/` too: its header had the same wrap at 1181 px.
- **Check.** All 10 labels at 861, 1024, 1180, 1181, 1280, 1339, 1340, 1440 and 1920 px:
  - bar height always 64 px
  - tagline and links on one line
  - nothing outside the bar
  - no question shortened at any width
- Phones (360, 390, 768): no overflow, on both pages.

## v3f: the band on generated ampoule labels (2026-10-31, user review)

- **Bug.** The coloured band was laid out across the photograph's full 196 px, but the ampoule's label spans only x 4–191. The band stuck out 3–4 px past the glass on each side, as ears on the dark ground. The v3e check at 3× showed the 1 px overhang and was misread as aligned.
- **Fix.**
  - The band is inset 5 px each side.
  - `clip-path: inset(0 5px)` keeps all print on the label.
  - Bands also refit on `document.fonts` `loadingdone`, so a face that loads late (a slow first visit) cannot leave text sized for the fallback font.
- **Check (`scratchpad/bands.mjs`).** Every generated label in all 9 drips, at 1440×900, 1440×900 with fonts delayed 2 s, 390×844 and 1024×768: 68 labels, 0 bad.
  - Each band sits within x 5–191.
  - Its text keeps at least 4 px from the band's edges.

**Responsive re-run on the v3f code (2026-10-31).**
- Band check: 360, 390, 768, 1024, 1440 and 1920, plus 390 and 1440 with fonts delayed 2 s. 136 labels, 0 bad.
- Full-page audit, every frame at 390, 768, 1024, 1440 and 1920:
  - 0 horizontal overflow, 0 console errors.
  - No text under the header in a pinned stage.
  - No overlaps beyond the known by-design cases: the phone sticky bar, the rail mid-pan, closed FAQ answers, and the hero headline passing behind the bag as in the client's.
- Vial row zoomed at 360, 768, 1024 and 1920: every band flush inside its label.
