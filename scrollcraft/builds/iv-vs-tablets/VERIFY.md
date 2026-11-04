# IV vs Tablets prototype: assets and verification (2026-10-30)

The client's page (`_reference/NutriDrip IV Nutrient Therapy/iv-vs-tablets.html`,
`ivtabs.css`, `ivtabs.js`), with the v3 landing's chrome, our data and our
primary action, the health quiz. **Treatment: Full**: it persuades, and its
one peak is the pinned two-route act. The route at port time is
`/iv-vs-tablets`.

Rebuild (from `nutridrip-new/`):
- `node scrollcraft/builds/iv-vs-tablets/tools/render.mjs`: writes `index.html`,
  and `ivtabs.css` (the client's file unchanged, then `tools/ivtabs-patch.css`).
- Serve: `node ~/.claude/skills/scroll-craft/scripts/serve.mjs --root scrollcraft/builds/iv-vs-tablets --port 4550`

Copied from home-v3 on 2026-10-30 at 18:11:
- the engine, unchanged; it matches the skill's `engine/` byte for byte
- `site.css`, the client's file with the v3 patches (md5 c048bee9)
- the fonts
- `data/drips.json` (md5 6e229184) and `data/site.json`
- the two photographs

`pages.css` is not used: nothing on this page uses its classes.

## Assets

| File | Source | Licence |
|---|---|---|
| `assets/tablets.webp`, `assets/ivline.webp` | Client artifact (byte-identical to `assets/img/`) | Supplied by the client for their site. No watermark, no baked text |
| `fonts/outfit-*`, `fonts/geist-*` | Client artifact | SIL OFL 1.1 (`fonts/OFL-*.txt`), commercial use allowed |
| `scrollcraft.js`, `scrollcraft.css` | scroll-craft engine | Unchanged |

## Content keys (all new, for `CONTENT_DEFAULTS` at port)

The values are the client's wording, in `COPY` in `tools/render.mjs`.

| Group | Keys |
|---|---|
| Page head | `ivtabs.heading`, `ivtabs.lede` |
| Tablet route | `ivtabs.tab.label`; `ivtabs.tab.{1..5}.title` and `.body`; `ivtabs.tab.{1,3,5}.short` (the phone row's "Mouth", "Gut" and "Blood") |
| IV route | `ivtabs.iv.label`; `ivtabs.iv.{1,2}.title` and `.body` |
| Meter words | `ivtabs.level.full`, `.less`, `.lessAgain`, `.part` |
| Act's end | `ivtabs.summary`, `ivtabs.note` |
| Sections | `ivtabs.absorbed.heading`/`.body`, `ivtabs.different.heading`/`.body`, `ivtabs.enough.heading`/`.body`, `ivtabs.choose.heading`, `ivtabs.choose.{1..4}`, `ivtabs.limits.heading`/`.body`/`.body2`/`.link` |

`ivtabs.iv.1.body` carries a `{duration}` token. The page fills it from the
drips: the shortest `durationMin` to the longest `durationToMin`, which is
"30 to 120 minutes" today, worded like the landing's day timeline. The client's
"45 to 60 minutes" is gone. The port has to substitute the token, or split the
sentence around it.

Not new: the booking section and the footer are home-v3's markup, with the
same facts.

## Clinical claims for physician sign-off

All of these are the client's wording, kept as written. None are new.

**Absorption**
1. A tablet has to break down and dissolve in the stomach first.
2. "B12 also needs intrinsic factor, made in the stomach."
3. Nutrients cross the gut wall through transporters (carriers) "that can
   fill up" and "can only move so much at once".
4. "Vitamin C, for one, is absorbed less efficiently at higher doses."
5. Blood from the gut passes through the liver first. "For some substances,
   part of the dose is processed here (the first-pass effect)."
6. "What remains reaches your blood. How much varies with the nutrient, the
   dose and your gut." Also: "Some of the dose is lost or held back along the
   way", depending on the nutrient, the dose, food in the gut and gut health.

**IV**

7. IV nutrients "are in your blood directly. No stomach, gut or liver on the
   way". They "skip the stomach, the gut wall and the first pass through the
   liver".
8. "Same dose, two routes. By mouth, part of it is absorbed. By IV, all of it
   enters the blood."
9. The meter's drain is illustrative: full, then 88%, 62% and 46%, worded
   "A little less", "Less again" and "Part of the dose". It is covered by
   "Illustration, not to scale".

**When tablets are enough**

10. For many people with a varied diet and a healthy gut, food and tablets are
    enough, and they are usually the first thing a doctor tries.

**When a doctor may choose IV**

11. Poor absorption; a deficiency on blood tests; gut conditions; when
    nutrients are needed quickly, "as with IV iron for low iron stores".

**Risks**

12. Small risks that tablets don't carry: bruising at the cannula site and,
    rarely, an allergic reaction.

**Process.** These need checking against how NutriDrip actually works:

13. "IV doses are set by a doctor, run slowly, and given only after tests."
14. "It needs tests, a doctor's prescription and a trained team."
15. "The doctor chooses it only when it fits your results."
16. "Emergency drugs are at the chair."

Our flow takes baseline vitals at every session, but lab tests only where a
drip's own notes ask for them ("Requires recent labs" on Iron Restore). So
"given only after tests" and "your results" may promise lab work we do not
do for every drip.

Claim 16 matches the landing's "the nurse confirms the anaphylaxis kit is
present and in date".

## Checks on the final files

Tools, all in `tools/`:
- `audit.mjs`: section by section, plus the act at 14 progress points
- `sbs.cjs`: the side-by-side sheets
- `kv.mjs`: LCP, CLS and keyboard stops

| Check | Desktop 1440×900 | Phone 390×844 | Reduced motion |
|---|---|---|---|
| `shoot.mjs` (dead scroll, contrast) | pass, 7 frames | pass, 7 frames | pass, 6 frames (act is flow) |
| Console errors / failed requests | 0 / 0 | 0 / 0 | 0 / 0 |
| CLS on load / after a full scroll | 0 / 0.005 (client: 0 / 0.009) | 0 / 0 at 4× CPU | — |
| LCP | 240 ms (the h1) | 576 ms at 4× CPU (the lede) | — |
| Keyboard | 27 stops, all visible on focus | — | — |
| Blur or `backdrop-filter` on sticky or moving layers | none | none | — |

**Width by width.** The act's numbers are measured at its end; the dose was
measured at every node. "Air" is the visible space between the closing panel
and the bottom of the screen.

| Width | Dose on its node | Line ends on first/last node | Closing panel | Overflow | Under the header | Notes |
|---|---|---|---|---|---|---|
| 390×844 | ≤0.1 px | 0 px | fits, centred, 92 px air | none | none | phone row layout |
| 390×667 | ≤0.1 px | 0 px | fits, 38 px air | none | none | compact rules for short phones |
| 768×1024 | ≤0.2 px | 0 px | fits, centred | none | none | tablet tier: larger type |
| 920×682 | ≤0.1 px | 0 px | fits, 33 px air | none | none | nav in the Menu |
| 1024×768 | ≤0.2 px | 0 px | fits, 33 px air | none | none | nav in the Menu |
| 1440×900 | ≤0.1 px | 0 px | fits, 29 px air | none | none | full nav |
| 1920×1080 | ≤0.2 px | 0 px | fits, 29 px air | none | none | full nav |

Every section was screenshotted at each width and looked at zoomed in (`lab/a-<W>x<H>/`).
Reduced motion is in `lab/r-390x844` and `lab/r-1440x900`. The pinned act's
notes clear the closing panel at every width; the closest is 6 px, at 390×667.

**Side by side**, aligned by section, client on the left:
- desktop: `lab/sbs-desk/sbs-1..4.jpg`
- phone: `lab/sbs-m/sbs-1..5.jpg`

## Fixed during the pass

**The client's motion and layout** (each one shows in their page too, in the sheets):
1. **The dose dot drifted off its node** as the tablet's level drained: 14 px
   at Stomach, 33 px at Bloodstream. The dot shrinks through `scale`, which
   multiplies a `transform: translate()`. Now positioned with the `translate`
   property: within 0.2 px at every node, every width.
2. **The IV line stopped 37 px short of "Bloodstream".** The tablet line also
   started 3.5 px above its first node, and on phones ran 3 px below the node
   centres. Both lines are now measured between node centres.
3. **Nodes jumped as each note opened**, up to 60 px at 1440, at the moment the
   dose arrived. They now glide (FLIP, 320 ms), and the dose and line follow
   the drawn positions.
4. **On phones "By tablet" sat at the far right**, the meter at the left (grid
   auto-placement). Now the name is first, the meter beside it, and the level
   underneath.
5. **The tablet route was drawn in #C9861A**, the app's clinical caution hue.
   It is now slate (#5E6B67).
6. **The closing panel touched the routes**, with 3 px of screen under it,
   and "blood." sat alone on the summary's last line. It now has air above
   and below, and a balanced wrap.
7. **The phone sticky bar and WhatsApp button covered the act's end.** The
   sticky bar now hides while the act holds the screen, and there is no
   WhatsApp float: the primary action is the quiz.
8. **The two cards were of unequal height.** They now end level.

**Ours**
9. **390×667:** the closing action fell 26 px below the screen. Short phones
   now get compact spacing.
10. **768×1024:** the act was top-heavy, with a third of the screen empty and
    phone-sized type. It is now centred, with a type tier for 600 to 860 px.
11. **390 px:** the slip's empty state broke the time pill into four lines.
    The price now goes under the name on narrow phones.
12. **Reduced motion on phones:** the meter was squashed. My code chose the
    axis by screen width; it now uses the meter's shape. The stops also use
    their full names.
13. **A desktop-only grid height leaked onto phones**, my own regression. It
    is scoped to desktop now.

**Copy changes**
- "45 to 60 minutes" is now our real range.
- "Book a consult" and "Free consultation…" are now the health quiz, with
  home-v3's notes.

## Not verified

- **A real phone** (iOS touch scrolling).
- **The real header and footer.** These are stand-ins for the restyled
  `SiteChrome`. The home-v3 nav does not list "IV vs Tablets" yet.
- **The route itself.** Dev and production LCP/CLS come with the port.
- **The claims above.** They need a physician's sign-off.

## Open questions

- **Process claims 13–15** ("given only after tests", "fits your results"):
  do they match our lab policy?
- **Tablet colour:** slate, or the client's amber? The amber equals our
  caution hue.
- **The dark "The limits, honestly" section** is kept as the client's.
  AGENTS.md allows dark grounds only when the user asks; the user chose
  "the client's look exactly".
