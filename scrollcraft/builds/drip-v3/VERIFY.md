# Drip page v3 prototype: assets and verification (2026-11-02)

The client's drip page (`_reference/NutriDrip IV Nutrient Therapy/drip-glow.html`), filled from our Drip documents, with the user's chosen motion: each ingredient's bottle drops into the sticky bag as it is read. Decisions are in `BRIEF.md`.

**Rebuild:**
- `node scrollcraft/builds/home-v3/tools/export-drips.mjs`
- `node scrollcraft/builds/drip-v3/tools/export.mjs`
- `node scrollcraft/builds/drip-v3/tools/render.mjs`

**Serve:** `serve.mjs --root scrollcraft/builds/drip-v3 --port 4560`. Pages: `/` (Myers' Revive) and `/test/<slug>.html` (every drip).

## Assets

All copied from the app's `public/`; nothing generated.

| File | Source |
|---|---|
| `site/v3/bag-empty.webp`, `bag-mask.png` | Client artifact, clean plates |
| `site/v3/ampoule-blank.webp`, `vial-calcium-blank.webp`, `vial-vitc-blank.webp`, `vial-cap-mask.png` | The client's glass with its print lifted off (`home-v3/tools/blank-ampoule.mjs`, `blank-vial.mjs`); our labels are HTML |
| `fonts/v3/*` | Outfit and Geist, SIL OFL 1.1 |

## Stylesheets

| File | What it is |
|---|---|
| `scrollcraft.*` | The engine, unchanged |
| `site.css` | The app's shared site stylesheet source |
| `glass.css` | The glass, label and liquid rules copied from the home page; shared at port |
| `drip.css` | The client's `pages.css` drip block, unchanged, then our patches (marked v3) |

## Checks

| Check | Result |
|---|---|
| Full-page walk at 1440×900 (Myers' Revive, Glow Protocol) | No overflow, no console errors. Only flags: closed FAQ answers (by design) |
| Full-page walk at 390×844 (Glow Protocol) | No overflow, no console errors. Flags: the phone's sticky bar and closed FAQ answers (by design) |
| The bag as the list is read (`lab/bag-sequence.jpg`) | The count climbs 0 to 7. Each in-bag ingredient's bottle shows over the bag, then drops in. The liquid rises a step as each lands and is full at "7 of 7" |
| Sticky column fits under the bar | 1440×900: ends at 865 px. 1024×768: 750. 1920×1080: 933. 1180×820: fits |
| "Given separately" vial | 15–23 px clear of the bag, at least 41 px from the text column, at 1024, 1180, 1440 and 1920 |
| Reduced motion | All rows lit, count full, bag full, no bottles moving, the separate vial shown |
| `shoot.mjs` (desktop, phone, reduced) | Pass, 0 console errors, 0 failed requests. The page has no engine acts, so the harness takes one frame; the walks above are the coverage |
| Side by side with the client's Glow page | `lab/sbs-glow.jpg`. Phone: `lab/phone-glow.jpg` |

## Fixed during the pass

- **The full dose label covered 60% of the bag and hid the rising liquid.** Replaced by the client's compact label (wordmark, name band, ∞ | volume) in the upper middle.
- **The bag was smaller than the client's** (60svh against 74). Now 66svh, with a 12svh drop zone above it.
- **The "given separately" vial overlapped the bag's corner.** It is now placed from the bag's own width.
- **An odd number of benefit cards left an empty grey cell.** The last card now spans the row.
- **Em dashes in two shared FAQ answers** (`src/lib/data/marketing.ts`), which the landing also shows. Removed.

## Not verified yet

These come with the port:
- the real route, with the stock availability line
- widths 768 and 1920 on phone-style layouts
- a real phone

## After user review (2026-11-02): a fast scroll

- **Bug.** Scrolling fast lit several rows at once. Their bottles fell together and stacked over the bag, and the bag stayed empty until they all landed ("6 of 7 read" over an empty bag).
- **Fix (`page.js`).**
  - The drops wait for the reader to pause (140 ms without a new row).
  - Everything read in that burst goes into the bag at once, and the liquid eases up to it.
  - Only the latest bottle makes the visible fall. Read slowly, one row at a time, and every bottle still falls.
  - Reading back up drains the level; no bottle appears.
- **Check (`scratchpad/fastscroll.mjs`).** Every frame through the list and back, watched for 3 s after the scroll stops:

  | Run | Max bottles visible at once | Bag full after | Back up |
  |---|---|---|---|
  | 1440, fast (160 px a frame) | 1 | about 2.2 s | 0 bottles, empty in about 1.7 s |
  | 1440, medium (40 px a frame) | 1 | about 2.5 s | 0 bottles, empty in about 2 s |
  | 390, fast | 1 | about 2.3 s | 0 bottles, empty in about 1.7 s |

  No errors in any run.
- **Slow reading** (`lab/bag-sequence.jpg`): every bottle falls in turn; the count and the level climb together.

## After user review (2026-11-02): ingredient names on the bag's label

- **Asked.** Print each ingredient's name on the bag's label as it is added.
- **Built.**
  - `render.mjs` gives the compact label a line list, as the home label has: the carrier with the bag's volume, each in-bag ingredient (name and dose), and "Given separately: …".
  - `page.js` already printed `data-line` c / k / s as each row lit or each bottle landed; until now the compact label had nothing to print into.
- **Grows, not reserved.** Keeping room for every line from the start left a blank white card before any reading. Now the label begins as the client's compact one, and each line prints in and extends it downward; reading back up shrinks it again.
- **Placement.** Widened to the home label's 16.5% inset, so "Cyanocobalamin 1,000 mcg" fits; it had pushed every line 1 px into the margin at 18%. Raised from 27% to 23%, so liquid shows above and below it when full.
- **Long names.** "Magnesium sulphate", "Electrolyte concentrate" and "Given separately: Pheniramine maleate" wrap to a second line, indented under the text, with the dot beside the first line.
- **Checks.**

  | Check | Result |
  |---|---|
  | Overflow, all 9 drips at 1024 (Myers' Revive at 1440, Hydrate Plus and Iron Restore at 1920) | None |
  | Clipped lines | None |
  | Label on the bag, full (Myers' Revive, 7 lines) | 23% to 74% of the bag's height. Others end at 64–72% |
  | Line type | 8.8 px at 1024, 10.3 at 1440, 11.1 at 1920 |
  | Reduced motion | Every line printed, no transition |
  | Fast scroll | Re-run unchanged: at most 1 bottle, full in about 2.3 s, no errors |

  Sequence: `lab/label-lines.jpg`, at 0, 1, 3, 5 and 7 of 7 read.
- **Phone.** The label stays hidden below 860 px, as before: the bag is about 180 px wide there, so the lines would be about 6 px. The list beside it names every ingredient.

## After user review (2026-11-02): the label keeps one size

- **User.** "label should not auto increase height, it looks bad". A growing label also moved its foot (∞ | 500 mL) down with every bottle.
- **Now.** The label is one size from the first frame, with a ruled row for every line of the drip.
  - An unread row is a hairline and a faint dot, so the empty label reads as one waiting to be filled, not a blank card.
  - As each bottle lands, its name and dose print onto the row and the dot fills; nothing else on the label moves.
- **Dots hang in the margin**, so the names start under the wordmark. That gains about 10 px per row, and "Magnesium sulphate 1,000 mg" (7 px short before) and "Electrolyte concentrate 20 mL" (5 px short) now keep to one row. The rows are even.
  - The only wrap left is "Given separately: Pheniramine maleate" (Iron Restore), which is always the last row.
- **Checks.**
  - No overflow and no clipped lines (Myers' Revive at 1440; Hydrate Plus, Iron Restore and Immune Shield at 1024).
  - The full label runs from 23% to 75% of the bag on Myers' Revive (7 rows), and to 65–67% on the 4-row drips.
- `lab/label-lines.jpg` now shows this version: Myers' Revive at 0, 3 and 7 of 7 read, then Hydrate Plus and Iron Restore.

## After user review (2026-11-02): lines printed on the bag

- **Problem.** The bigger card covered the rising liquid from about 1/6 to 5/6 full, and the bag shows no liquid beside it. At "4 of 7" the bag looked the same as at "1 of 7".
- **User's choice.** Print the lines on the bag.
- **Now.**
  - The label is the client's compact card again (wordmark, name band, ∞ | 500 mL), one size from start to end.
  - The ingredient lines are printed straight on the clear bag beneath it, as a real IV bag is printed, so the liquid is seen rising behind them.
  - The room for every line is kept, so nothing moves; each line prints in as its bottle lands, and nothing shows before then.
  - The card and the lines are one block (`.dp__print`), at 22% from the bag's top and 16.5% in from each side.
- **Checks.**

  | Check | Result |
  |---|---|
  | Overflow | None (Myers' Revive at 1440; Hydrate Plus, Iron Restore, Glow Protocol and Athletic Recovery at 1024 and 1920) |
  | One row per line | Every line except "Given separately: Pheniramine maleate" (Iron Restore), always the last row |
  | Block on the bag | Card 22% to 50% (53% where the name takes two lines); lines end at 63–71% |
  | Liquid | Seen rising behind the lines from the first in-bag ingredient, above the card when full (`lab/label-lines.jpg`, at 0, 1, 3, 5 and 7 of 7) |
  | Text over the liquid | Dark ink on the light tints: readable on lavender, pink and teal at 3× zoom |
  | Reduced motion | Every line printed |
  | Fast scroll, 1440 and 390 | At most 1 bottle visible; full in about 2.3 s (2.5 s on the phone); empty again in about 1.7 s scrolling up; no errors |
- **Phone.** The card and the lines stay hidden below 860 px, as the card was before.

## After user review (2026-11-03): lines back inside the label

- **User.** Seen on the page, the lines printed on the clear bag read as text floating outside the label ("what is this text outside of a label?").
- **Choice.** The white label with the ruled ingredient rows inside, offered against a label with a see-through lower half.
- **Now.** That version is back, exactly as before: one size from start to end, empty rows as hairlines and faint dots, and each name and dose printing onto its row as its bottle lands.
- **Accepted.** The liquid is hidden behind the label in the middle of the read: it shows below the label at first and above it near the end.
- **Checks.** These match the earlier version:
  - Myers' Revive runs from 23% to 75% of the bag.
  - No overflow.
  - Only Iron Restore's last row wraps.
  - Reduced motion shows every row.
  - Fast scroll at 1440: at most 1 bottle, full in about 2.3 s, no errors.

  `lab/label-lines.jpg` shows this version again.

## Port (2026-11-03)

Approved by the user ("done"), then ported into `src/app/(site)/drips/[slug]/page.tsx`.

**Files**

| File | What it is |
|---|---|
| `src/components/site/drip/DripPage.tsx` | The page (server), from `render.mjs` |
| `src/components/site/drip/DripMotion.tsx`, `motion.ts` | The client root and `page.js`, through `useScrollCraft` |
| `src/components/site/v3/glass.ts` | The glass markup, band colours and label fit, moved out of `home/motion.ts`, shared |
| `src/components/site/v3/liquid.ts` | The liquid, moved out of `home/motion.ts`, shared. The drip page passes the prototype's constants (ease .92, a drop every 110 ms, round drops) |
| `src/components/site/v3/LiquidFill.tsx` | The liquid's markup and the ∞ mark, shared |
| `v3/styles/glass.css` | The glass, label print and liquid rules, moved out of `home.css`, shared |
| `v3/styles/drip.css` | The client's drip block, then this build's patches |

**Changes from the prototype**

- **Label list class.** The label's list is `.dpl__lines`, not the build's `.build__lines`. `home.css` stays loaded after a visit to the landing, and its `.build__lines li` rules (scale 1.25, opacity 0) would reach the drip label.
- **Merged label rules.** The label's rules from `glass.css` and `drip.css` are merged into one set. The computed result is unchanged.
- **Photo class.** The glass photo has its own class (`.vial__photo`), so the shared rule outranks the landing's `.vial img` whatever order the stylesheets load in.
- **Slip spacing.** `.nd-slip__body` moved from `home.css` and `ivtabs.css` into `site.css`. The drip page's slip had that spacing only after a visit to one of those pages.
- **Offer badge at 768.** "No card needed…" sat beside the quiz button at 768, where the column fits both, and read as a second button. It now has its own line at every width.
- **Stock line.** Kept from the old page, but shown only when stock is low or out ("Only N left today", "Out of stock"), in the status hues with their text tints: 6.6:1 and 7.8:1.
- **Bag image.** It is the page's largest picture on the first screen (its LCP), so it is marked `fetchPriority="high"`.
- **Drip colour.** `getAssemblyDrip` now returns it.
- **Photo slots.** The drip page's two photo slots (session, closing) are retired from `lib/media/slots.ts`.

**Checks** (dev server on 3002 unless noted)

| Check | Result |
|---|---|
| Bag label, 9 drips, at 1024, 1440, 1920 | Same as the prototype: Myers' Revive 23–74.7% of the bag; no overflow; only Iron Restore's "Given separately" row wraps |
| Fast scroll, 1440 and 390 | At most 1 bottle in the air. Full in 2.3 s (2.5 s on the phone). Empty in 1.7 s back up. No errors |
| Full walk at 390, 768, 1024, 1440, 1920 | No overflow, no errors. Flags only the closed FAQ answers and, under 860 px, the phone bar over the text |
| Client navigation: home → Myers' Revive → Jetlag Reset → IV vs Tablets → Back → home | One engine at every stop, the wrapper's classes clean. Each drip builds its own bag, colour and count. No landing rule reaches the label rows. No errors |
| Reduced motion, 1440 and 390 | All rows lit. Bag full and still. Label printed. No bottles. The separate glass shown |
| Production (port 3210), drip page | LCP 1.14 s at 1440; 1.14 s at 390 with 4× CPU; the LCP element is the bag. CLS 0.0001. 39 tab stops, all visible |
| Landing after the shared code moved | 236 glass labels at 8 widths, 0 bad. The build pours smoothly (no backward steps). No errors. Production LCP 1.2–1.3 s. The shifts that remain predate this port (the header's question button, IV's stops). All pages measured slower than in the earlier session, IV included, whose code hardly changed |
| Typecheck, lint, tests | Pass; 788 tests |

## After the port (2026-11-03): a photo from the admin

- **User.** "If admin uploads an image from the Admin panel, instead of our bag show that image" (the Drips list), "also in drip details page". Then the choice: the photo in the hero, the bag stays.
- **Prototype.**
  - `test/myers-revive-photo.html` shows Myers' Revive with a shipped stand-in playing the upload.
  - The photo sits under the description, 2:1 and held to 34svh, at the admin's focal point.
  - With no upload the page is as approved.
- **Check.** The quiz button stays on the first screen at 1440 × 900 (bottom at 789), 1024 × 768 (726) and 390 × 844 (709). No overflow or errors.
