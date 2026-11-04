# Drips list v3 prototype: assets and verification (2026-11-03)

The landing's formulary cards as a grid under the site's page heading, with the goal filter and the search. Decisions are in `BRIEF.md`.

**Rebuild:** `node scrollcraft/builds/drips-v3/tools/render.mjs` (from `nutridrip-new/`).

**Serve:** `serve.mjs --root scrollcraft/builds/drips-v3 --port 4570`. Pages:
- `/`: as the dev data has it, with no uploads and stock fine.
- `/test/photos.html`: two stand-in "uploads" and two stock states.

The drip page's photo case is `drip-v3/test/myers-revive-photo.html` (port 4560).

## Assets

All copied from the app's `public/`; nothing generated.

| File | Source |
|---|---|
| `site/v3/bag-empty.webp`, `bag-mask.png` | Client artifact, clean plates (as the landing) |
| `images/site/drip-bag.jpg`, `goal-skin.jpg` | The shipped stand-in photos, playing an admin's upload on the test pages only (the real page never shows a stand-in) |
| `fonts/v3/*` | Outfit and Geist, SIL OFL 1.1 |

## Checks

| Check | Result |
|---|---|
| First screen, 1440 × 900 | Heading at 180 px, search at 422, chips at 488, count at 552, first card at 612 |
| First screen, 390 × 844 | The chips wrap to three rows |
| Full walk at 390 (photo test), 768, 1024, 1920 | No overflow, no console errors, no flagged frames |
| `shoot.mjs`: desktop, 390, reduced motion | Pass; 0 console errors, 0 failed requests |
| Filter and search, driven | Each goal chip narrows the list. The search keeps the goal. "All" keeps the search. "xyz" shows the no-match message and "Clear the search". Back restores the last state. `?goal=Skin` opens filtered. The address follows every change |
| Photo in a card (test page) | Portrait (IV bag) and landscape (portrait photo) both crop cleanly into the bag's box at the admin's focal point. The card lines up with its neighbours |
| Stock on a card (test page) | "Only 2 left today" (amber) and "Out of stock" (red), each with its dot |
| Drip page with a photo (`drip-v3` test), 1440, 1024, 390 | The photo sits under the description, held to a third of the screen. The quiz button stays on the first screen at all three widths. No overflow or errors |

## Fixed during the pass

- **The close sat centred.** Its narrower width was on the same element as `.nd-wrap`. It now lines up with the page.
- **"vitamin c" matched almost every drip.** The prototype searched each ingredient's vitamin as well, so "vitamin" matched B12. It now searches what the app's search does: name, goal, ingredients and tagline.

## Port (2026-11-03)

Approved by the user ("approve"), then ported into `src/app/(site)/drips/page.tsx`, with the photo rule on the landing's cards and the drip page.

**Files**

| File | What it is |
|---|---|
| `src/components/site/drips/DripsBrowser.tsx` | Chips, search and grid (client). The state is the address (`useSearchParams`, native `pushState` and `replaceState`); the search is the app's `drip-search.ts` |
| `src/components/site/drips/DripsMotion.tsx` | The root: the engine (reading bar, the close's entry, the bags' tilt) |
| `src/components/site/v3/Fcard.tsx` | The card, moved out of `Landing.tsx` and shared, with `photo` and `stock` |
| `v3/styles/fcard.css` | The card's rules, moved out of `home.css`. The rail's own rules stay there as `.formulary .fcard` |
| `v3/styles/drips.css` | The list's rules, from this build |
| `lib/media/resolve.ts` `uploadedDripPhotos` | A drip's upload, or null; never a stand-in |

**Changes from the prototype**

- **Filtering.** The server applies the same filter from the URL, so the chips (links) and the search (a form) work without the script.
- **Search words.** As the old list: name, goal, every ingredient, the drip's tags and its tagline.
- **Goal.** From the card read, so the chips and the cards agree for rows older than the goal field.
- **Photos.** Through `Photo` (next/image, responsive sizes, the blurred preview): `sizes="68px"` on a card; on the drip page `preload`, as it may be the first screen's largest paint.
- **Crumb links.** Underlined again in `site.css`. The client left it to the browser, and the app's base styles had taken it away on every ported page.
- **Retired.** The `drips.closing` slot and the "Drips" page group in Admin → Site images.
- **Drip photo frame.** Now the drip page hero's: 652 × 326 (1920), 254 × 127 (390). The admin's note says where an upload shows.

**Checks** (dev server on 3002 unless noted)

| Check | Result |
|---|---|
| First screen at 1440 and 390 | Same places as the prototype, to the pixel |
| Full walk at 390, 768, 1024, 1440, 1920 | No overflow, no errors, no flagged frames |
| Filter and search, driven | Every case works; Back steps through the filters. 0 server requests while filtering. With JavaScript off, the chip links and the search form give the same lists |
| Client navigation: home → Drips → chip → a card → Back → IV vs Tablets → home | One engine at every stop, classes clean. The grid cards keep the list's layout (363 px, no height cap, no tilt) after a visit to the landing. No errors |
| Reduced motion | No glide; the close shows in full |
| Landing's cards (shared card) | Head rows identical across cards, as before |
| Drip page without a photo | Walk at 1440 as before (only the closed FAQ answers flagged) |
| Production (3210) | `/drips` LCP 0.49–0.50 s at 1440; 1.0 s at 390 with 4× CPU; CLS 0–0.0021 (fonts settling); 45 tab stops, all visible. Landing 0.86 s, drip page 0.97 s |
| Typecheck, lint, tests | Pass; 788 tests |

**Not verified:** a real upload end to end. No drip has one in the dev data, and the check did not write to the database. The photo path is the shared `Photo` component, and the frames were measured in the app.
