# NutriDrip landing page v2 (`/`): brief and plan

**Checkpoint 1 of 3.** This file is the plan. Nothing in this folder is generated
or built until it is approved.

Sources read before planning: `_reference/Images/scroll-reference/MOTION-PLAN.md`
and all eight `perkform-*.png` frames, v1's `BRIEF.md`, `VERIFY.md`,
`ASSETS.md` and `prompts/`, the live `src/app/(site)/page.tsx` and every
component it uses, `globals.css`, `content.ts`, `marketing.ts`,
`site-images.ts`, the Drip and BatchLot models, the zone hours in
`lib/clinical/slots.ts`, and the scroll-craft references (hero-depth,
approved-collection, feel, uniqueness, devices, taste, assets).

**Brief status: mostly given, partly authored.** The user set the goal, the
conversion, the signature move and its eight steps, the honesty rules, the
asset rules and the checkpoints. Lines marked *Authored* are my decisions,
open for change at this checkpoint.

---

## What v1 got wrong, and what v2 does instead

| v1 | Cause (from its files) | v2 |
|---|---|---|
| The bag read as a stock photo | `prompts/preamble.txt` asked for "seamless pure white", "near-shadowless", "no contact shadow", "huge white bounce": the recipe for catalogue packshots | Studio glass light: grey sweep, black flags making dark edge reflections, one strip specular, a contact shadow and a floor reflection |
| A flat grey label rectangle with an HTML sticker on top | The bag prompt baked in "one large plain matte white rectangular label panel"; the HTML sat above everything | No panel in the photo. Layer order: bag body, then the printed label, then the bag's own sheen extracted as a separate layer **above** the label |
| A blue twist-off cap | Asked for in the prompt | Neutral ports only (white, clear, grey) |
| Soft, generic vials | Same preamble; floating, shadowless, no label area | Real form per ingredient from its stock lots; blank label area; same set and light as the bag; real relative scale |
| The assembly ignored the reference | Ingredients flew into a port while a ghost bag filled | The reference order exactly: spread, converge, collapse into a ring, the bag emerges from the point, fill, turn, callouts, grounded |

---

## The eight topics

**1. Vibe.** User: the merge must look "real and premium", "a premium product
shot, as the reference can does". *Authored, in four words:* **exact, lit,
calm, white.**
References: the PERKFORM sequence (how it moves, not how it looks), studio glass
photography (dark edge reflections on clear material), and the live NutriDrip
site itself, which the page must still look like.

**2. The journey.** User: "Start from the live page's sections and content."
The section list below keeps the live order and changes only what serves the
story or the conversion.

**3. Energy.** *Authored:* a calm open, a long build inside the assembly that
drops to near-silence (a ring and a point), the loudest moment as the bag
emerges and fills, then a long settle through substance into a quiet close.

**4. Feeling, and the one moment.** User: the drip merge animation is the main
goal. The peak is the bag emerging from the point and filling (curve below).

**5. The thing no other site does.** User (AGENTS.md): the drip assembling
itself from the Drip document, never hard-coded.

**6. Range.** User: the current white UI, its tokens, Instrument Sans and Inter,
the existing header, footer, buttons and cards. No restyle.

**7. One world, or scenes?** *Authored:* distinct scenes on one white ground.
The assembly is one pinned act; everything after it is ordinary flow.

**8. Assets.** User: no NutriDrip bag photography exists; the rating, session
count and testimonials are placeholders that stay off. In the repo: the real
`LogoMark`, 24 Unsplash-licensed photos in `site-images.ts`, NutriDrip's own
home-visit photo. To make: the bag, one still per container form, and a home
scene plate with an empty IV-stand hook (see Assets).

---

## Data facts that shape the build

Queried read-only from the dev database (lots that are unexpired, not
quarantined, active; most common `unitForm`, Vial when none):

- **Forms in use: Ampoule (22 ingredient slots) and Vial (11).** The carrier is
  always a Bag. So two container stills, nothing else.
- **Myers' Revive:** carrier normal saline 0.9% 500 ml, plus six: ascorbic acid
  (Vial), magnesium sulphate (Ampoule), B-complex (Vial), cyanocobalamin
  (Ampoule), calcium gluconate (Ampoule), pyridoxine (Ampoule).
- **The carrier is not always saline.** Hydrate Plus and Athletic Recovery run on
  Ringer lactate, so the bag label prints the carrier's name from data.
- **Not everything goes in the bag.** Ondansetron and pheniramine are `PREMED`;
  Glow Protocol's glutathione is a push. The component must park those beside
  the bag ("Given separately"), not merge them. Myers' has none; the detail page
  will.
- **The evening time stamp is real.** Zones book `08:00` to `20:00` hourly by
  default, so the last slot is 7:00 pm. The stamp is derived from the served
  zones' hours and formatted with `src/lib/time` (12-hour, India time).
- Ingredient counts across the catalogue: 3 to 6 into the bag. The layout is
  built and tested for 3 to 9.

---

## The page, section by section

| # | Live section | v2 | Why |
|---|---|---|---|
| 1 | Hero (headline, quiz CTA, stars + "1,284 verified sessions", three figures, home photo with chips) | **Becomes the opening of the assembly act.** The live badge, `<h1>`, sub and both buttons stay, set over the drip's six real containers hanging at three depths. Scrolling turns the hero into step 1 | The merge is the story; opening on its objects means the first scroll already starts it, as PERKFORM's "TWO DRINKS." screen does. The home photo was the hero's job; step 8 now does it, at the end, as the payoff |
| | stars, "1,284 verified sessions", "4.9 avg. nurse rating" | **Removed** | Placeholders (your answer) |
| | "15 min" call, "{zones} zones" figures | **Moved into step 8**, under the time stamp | Real figures; the hero stays at four text elements |
| 2 | Trust strip (marquee) | **Kept**, now directly after the act | Credentials land right after the product, as proof |
| 3 | How it works (sticky steps) | **Kept** as is | The four accountable people; already works |
| 4 | Most booked (drip marquee) | **Merged with 5** | Two "choose a drip" sections in a row are one feeling twice (filler) |
| 5 | By goal (six tiles) | **One Range section:** "What are you trying to fix?", the goal tiles, then the most-booked drips beneath | One decision point instead of two |
| 6 | Where the safety sits (**deep** band, `01`–`04` numerals, stock vials photo) | **White.** Numerals dropped. Photo swapped to `nursePrep` | You asked for everything outside the merge to stay white. The benefits are not a sequence. Stock vials straight after the premium ones would undercut them |
| 7 | Reviews | **Removed** | Placeholders (your answer) |
| 8 | Comparison table | **Kept** | Verifiable, and it converts |
| 9 | Not for everyone | **Merged into 6** as its closing panel; the fourth benefit ("We will tell you no") folds into it | The same argument twice; merged, it ends the safety story on its strongest line and keeps both CTAs |
| 10 | FAQ (with "Ask a clinician" to `/consult`) | **Kept** | The secondary path lives here |
| 11 | Closing `CtaPanel` (**deep** band) | **Kept copy, light ground** ("Three minutes now, or another month of guessing.") | White rule. At port, `CtaPanel` gains a light tone; other pages keep the deep default |

*Alternative, if you prefer:* keep the live hero (photo and chips) and start the
act below it. Cost: the home scene appears twice (hero and step 8), and the
first screen says nothing about what goes into a drip. I recommend the version
in the table.

Conversion: `QuizButton` with `home.cta` ("Take the health quiz · 3 min") in
the hero, at step 8 and in the close, same label each time. Secondary:
"Ask a clinician" to `/consult` at step 8 and in the FAQ.

---

## Structure

**Grammar: filmic one-shot.** The reference sequence is one continuous product
film ending on one ask, which is exactly this grammar. Why the other seven lost:
chaptered editorial needs a folio nav (the shared capsule header forbids it; it
suits `/safety`); live surface has no product UI to run; continuous world has no
geography; typographic poster hides the objects the peak is made of; gallery /
catalog fits `/drips` and the drip detail page; split stage suits the
comparison, which is a sub-argument; rhythmic cutlist is the wrong energy for a
clinical service. Its bans hold: no section numbers, no progress readout (so no
PERKFORM side rail), one entry point.

**Nav and close:** shared `SiteChrome` capsule, unchanged (one-site rule). The
close is the light `CtaPanel`.

**Fingerprint gate:** `FINGERPRINTS.md` is empty, v1 never shipped, and the
site gets one row (`nutridrip-site`) when the first page ships. Nothing to
clear.

**Signature move:** the drip assembles itself. Its ingredients, in the forms
their stock lots record, collapse into one point and the labelled 500 ml bag
grows out of it.

**Motion limits from the live site** (they override the skill's defaults): no
`clip-path` or filter reveals, no blur or `backdrop-filter` on moving layers,
first-screen entrances in CSS, flow-section entrances with the site's own
`data-reveal` (transform only), loops paused offscreen.

---

## Feeling curve

```
Hero       Curiosity     real glass hanging at three depths around the plain promise; it leans as you move
Spread     Candour       every ingredient named, with its dose, standing in one row: nothing hidden
Collapse   Anticipation  they leave one by one and vanish into a point; the stage goes almost empty
Emerge     AWE  (peak)   a NutriDrip bag grows out of that point, already labelled, fills to 500 ml, catches the light as it turns
Callouts   Reassurance   two plain facts: how long it takes, who is responsible
Grounded   Warmth        the same bag on a stand beside a sofa at 7:00 pm; the quiz is one tap away
Trust      Credibility   the council registration and the checks, passing as a strip
How        Understanding a named, accountable person at each of four stages
Range      Appetite      start from the problem, or from the drip most people book
Safety     Respect       the limits as fact, ending on the people we turn away
Compare    Conviction    us, a drip bar, a hospital, row by row
FAQ        Relief        the questions people actually ask, answered plainly
Close      Resolve       three minutes now; one ask
```

No two adjacent lines share a feeling (Most booked and By goal did; merged).

**The peak.** *"I scrolled and the six little vials and ampoules flew into one
point, and a NutriDrip bag grew out of it with Myers' Revive printed on it and
filled to 500 ml."* It lives in the assembly act, gets the asset budget and the
largest span on the page.

**Tell-someone sentence.** *It's the site where the ingredients of your drip
fly into a single point and the bag grows out of it, already labelled with
exactly what's inside.*

**Authored silence.** Step 3, around p 0.44 to 0.48: the stage holds only the
ring and a point. Not dead scroll.

---

## Layer contract: the assembly act

Back to front. Every moving layer is `transform` and `opacity` only.

| Plane | Asset | Movement | Contact / occlusion |
|---|---|---|---|
| Ground | CSS: paper to `--color-surface-2` sweep with a soft pool of light at the floor line (white), or deep ink with the same pool (dark) | Still | The bag never sits on pure white |
| Far containers (hero only) | Container stills with depth of field baked in (`*-far`), smaller, lower contrast | Smallest parallax on pointer and scroll | Sit behind the headline |
| Copy | Hero `<h1>`, sub, buttons; then the step headline ("Six ingredients." → "One drip. Myers' Revive."), captions | Copy rides at 1×; headlines swap by opacity | Between far and focal planes on desktop; above everything on phones |
| Focal containers | One alpha still per form (Vial, Ampoule). Per instance: still, HTML name label, glass sheen layer above the label, separate contact shadow | Own staggered path to the centre, scale to 0.04 (never 0), then out | Each stands on its own shadow in the spread; the shadow stays behind and fades when it lifts |
| Near containers (hero only) | Two large instances cropped at the frame edge, baked depth of field | Fastest parallax; crossfade to the sharp still as they settle into the row | Frame the headline, never cover it |
| Ring | Thin circle in `--color-primary`, never a status hue | Contracts around the point, arc completes via two half-rings rotating behind fixed half-masks, widens to frame the bag, fades | Centred on the collapse point, the bag's growth origin |
| Bag group (one transformed element) | (a) bag body alpha still; (b) carrier liquid, SVG in a static clip of the bag's inner shape; (c) the printed label: primary header band, `LogoMark` and wordmark, drip name, carrier and composition small print, `500 ml`, "For intravenous use", graduation scale 100 to 500 ml; (d) the bag's own sheen and dark reflections, extracted from the still, **above** the label; (e) sweep bands for the turn; (f) contact shadow, separate | Grows from the point; liquid `translateY`; group `rotateY` with perspective; sweep bands `translateX` | Label edges inside the seal; slight perspective to follow the bulge; the studio shadow fades when the bag lands on the hook |
| Callout cards | HTML | Rise from the lower corners, then travel to the top corners in step 8 | Never over the label |
| Scene plate (step 8) | Evening living room, IV stand with an empty hook beside a sofa | Rises from below behind the bag | **Contact anchor: the bag's hanging hole lands on the hook** |
| Time stamp and CTA | HTML over the plate, with a scrim column only under the text | Arrive last | Readable at every frame (measured) |

---

## Scroll score, steps 1 to 8

One pinned act. Desktop span about **6 viewport heights** for Myers' (it grows
about 0.3 per ingredient so each keeps its scroll room); it is the largest
span on the page by a wide margin. `p` is act progress.

| Step | p | On screen | Built with |
|---|---|---|---|
| 0 Hero | 0 to 0.07 | The live headline, sub and quiz CTA over the six containers at three depths. Full opacity at p = 0 | Greet-and-hold cue; pointer parallax on fine pointers only |
| 1 Spread | 0.05 to 0.20 | Hero copy lifts away. Containers glide into one row at real relative scale (an ampoule is taller and slimmer than a vial), each on its shadow. "Six ingredients." arrives (the word comes from the count). Name and dose settle under each, left to right | Page-local JS on the engine's `--sc-p`; per-instance transforms |
| 2 Converge | 0.20 to 0.40 | One container at a time leaves along its own curve to the centre, outermost first, alternating sides. Its caption fades as it leaves | Start of each = 0.20 + i × 0.16 / n, 0.09 long, overlapping |
| 3 Collapse | 0.36 to 0.48 | Each arrival shrinks into the point. The ring contracts around it and closes. The headline fades. By 0.46: a ring and a point | Scale and opacity; the ring by rotation |
| 4 Emerge | 0.48 to 0.58 | The bag grows out of the point, label already printed; the ring widens to frame it, then thins away. "One drip. Myers' Revive." arrives faint behind and firms | One transformed group; headline swap |
| 5 Fill | 0.56 to 0.68 | The carrier rises in the film to the 500 ml mark; a readout beside the printed scale counts to the Drip's `volumeMl` and holds. The liquid stays clear: no invented colour | `translateY` inside a static clip; a fill always shows its number |
| 6 Turn | 0.68 to 0.78 | One gentle swing (0, −18°, +6°, 0). A dark edge band and a bright specular band sweep across the plastic; the label stays legible | `rotateY` on the group; bands translate on alpha layers |
| 7 Callouts | 0.76 to 0.86 | Two short cards rise from the lower corners: "45 to 60 min, given at home by a council-registered nurse" and "Approved by a physician before anything is prepared" | Copy from the Drip (`durationMin`, `durationToMin`) and the live copy (`HERO_POINTS`, `home.badge`) |
| 8 Grounded | 0.85 to 1 | The room rises behind; the bag scales onto the stand's hook; the cards move to the top corners; "7:00 pm" large, then "{zones} zones across Bengaluru · a 15 min call with your physician first"; then the quiz CTA and "Ask a clinician" | Photo plate; final cue closes at 1 (this is not the page's last act) |

**Honest proportions:** the six never add volume. The bag emerges empty and the
carrier fills it once, to its own number.

**Phones**, composed separately: hero headline on top with the containers in a
cluster below it; spread as a two-column grid (three rows), not a shrunken row;
the bag at least half the viewport height at step 5; callouts in a row under
the bag; a portrait crop of the room with the stand central.

**Reduced motion:** no pin and no travel. The hero composition stands still;
then the bag at step 5 (labelled, filled) beside the full ingredient list as
real text; then the room, time stamp and CTA as an ordinary section.

**Built for reuse.** The act reads one JSON island:
`{ name, volumeMl, durationMin, durationToMin, carrier, items: [{ name, dose, unit, role, form, separate }] }`.
At the port it is built by a read model from the Drip and its masters' lots,
so `/drips/[slug]` can mount the same act. Test pages render all nine drips plus
a nine-ingredient stress fixture, at 1440 and 390.

---

## Assets

| Asset | Count | Notes |
|---|---|---|
| Bag, white-ground lighting | 3 candidates | Blank clear film, no label panel, neutral ports, hanging tab with hole, no tubing; generous margins |
| Vial and ampoule, same set | 3 candidates | One sheet per candidate with both forms side by side at real relative scale, so the light is identical; blank label areas; neutral caps; the chosen bag passed as the reference image |
| Dark-ground variants | 2 (bag, sheet) | Only if the white-lit cutouts fail on ink; rim light instead of black-card reflections, shapes matched to the chosen pair |
| Home scene plate | 2 candidates | After you choose the ground. Evening living room, IV stand with an empty hook beside a sofa, no people (no tubing to align, nothing invented about a patient) |

About 10 calls, plus rerolls: plan for 14.

Processing: v1's `tools/prepare-assets.mjs` copied in and extended with a
high-pass sheen extraction (the bag's own highlights and dark reflections as a
separate alpha layer) and a contact-shadow split. v1's `tools/export-drips.mjs`
copied in and extended with each ingredient's form, the `separate` flag, the
carrier, and the zones' last slot. Both run read-only.

### Provider status (probed 5 Oct 2026)

| Provider | Result |
|---|---|
| KIE | Balance **52** credits. At the published 28 per still that is one still; I need about 14 from a single shoot. **Cannot cover it.** |
| Gemini | Key valid; seven image models listed. Every image model returns 429 with a **free-tier limit of 0** (`generate_content_free_tier_requests, limit: 0`). Retrying will not help. **Cannot be used on the free plan.** |
| Kling | Not needed: no video in this build. (Its key is not in access-key and secret-key form, so it would need your input anyway.) |
| Free stock | Possible, but no stock bag, vial and ampoule share one light, and stock IV bags are the look v1 was rejected for. Not recommended. |

**Decision needed before checkpoint 2:** see the question in the report.

---

## Verification plan (checkpoint 3)

`shoot.mjs` contact sheets at 1440 desktop, 390 mobile and reduced motion; a
frame strip of the assembly at ten evenly spaced positions; widths 390, 768,
1024, 1440, 1920 with overflow checks; keyboard order; contrast measured on the
composited frames; LCP and CLS on the prototype (dev and production numbers
come with the port). The headless browser runs only for these checks and is
closed after each.

---

## Checkpoint 2 decision (5 Oct 2026)

**Ground: ink**, chosen by me under the user's delegation ("use which looks
best"). On ink the KIE bag and glass read as a rim-lit product shot; on white
they read by their dark edge lines only. The hero opens on the white page
ground; the stage darkens to ink while the containers collapse into the point
(the authored silence becomes the darkest moment, right before the bag
emerges), and the page is white again after the grounded scene.

Assets: KIE bag 1 and KIE containers 1 (see ASSETS.md). The path-traced
containers render was the alternative; it reads as CGI beside the photographs.
