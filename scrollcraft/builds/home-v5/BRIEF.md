# NutriDrip home, preview v5 ("The chart")

**Self-authored under explicit creative delegation** (the prompt: "full creative authority … do not stop to interview me").
A standalone preview. It does not touch `src/app/(site)/page.tsx` or any route; open `index.html`.
Written 2026-11-24. Data and images: `../home-v4/HOME-BRIEF.md` and `images/`.

## The eight topics (authored)
1. **Vibe.** Clinical paper, ink, hairlines. A hospital chart that has been designed by someone who reads. References from other media: a pharmacy dispensing label, a case-notes folder, a hospital discharge summary. Not a site.
2. **Journey.** Recognition (the bag on the stand, in a bright room) → Tension (it is too often sold as a treat) → Turn (a doctor, before a needle) → Range (nine drips, every ingredient in view) → **Peak** (one evening, one bag, one morning) → Order (six steps) → Rigour (vitals, 29 steps, traced vials) → Honesty (IV or tablets) → Practical (pincode, price, questions) → Commitment (the quiz).
3. **Energy.** Calm open, a pulse at the physician, a long play section, then the quietest and largest act, the peak. Rigour is dark and tight; the practical sections are fast.
4. **Feeling curve** below. **The one moment** below.
5. **What no site does.** The infusion is the timeline: the bag's millilitres drain while the evening in the photograph turns to morning.
6. **Range.** Editorial-premium, with clinical records as the texture (mono for anything a clinician writes down, serif for anything a person says).
7. **Unbroken world or scenes?** Scenes. The only unbroken stretch is the peak.
8. **Assets.** The client's own, unchanged. Nothing generated. No video.

## Grammar
**The clinical chart:** the page is a record that fills in as you scroll. Each act is one entry. Nav is a plain fixed paper bar with a hairline: wordmark, five links, the one button. No ledger, no counter, no scroll cue.

## Feeling curve
| Act | Feeling | What causes it |
|---|---|---|
| Hero | Calm confidence | A real bag on a real stand in a bright room, slow sway, planes drift apart |
| Statement | Recognition, a small sting | A sentence that reads itself, word by word, at your scroll speed |
| Physician | Reassurance, then respect | A card is stamped Approves, Changes, Asks, **Declines** |
| Drips | Agency, curiosity | Pick a drip and its bag re-tints and refills; glass drops in by its own port |
| **Peak** | Release | The bag drains 500 → 0 mL in one pinned stretch while evening becomes morning |
| Six steps | Order, trust | Case notes stack, each one sealing the one before |
| Vitals | Tension, then control | You drag a heart rate out of range and the drip stops |
| IV or tablets | Candour | Two routes; the thin one is honest about where the dose goes |
| Where / price / questions | Ease | One field, one slider, one answer at a time |
| Close | Warmth, resolve | The room again, the same bag, the one button |

## The peak
**"I scrolled and the bag emptied while the evening turned into morning."** Act 5, `#session`, 760vh (700vh on a phone), the largest span on the page. The act before it (the drips) is interactive and loud; the peak is quiet.
It is coupled to the visitor's choice: the bag is the drip picked in the formulary (default Myers' Revive), the morning photograph is that drip's goal, and the report lists that drip's real doses.

## Tell-someone sentence
It's the site where you scroll through a whole infusion, from the evening visit to the morning after, with the bag emptying under your hand.

## Score
| Beat | Device | Why |
|---|---|---|
| Hero | layered parallax (room, bag on its hook, two near-plane glasses, light shaft) | depth without scroll-jacking |
| Statement | pin + scrubbed text + clip-path photo | the reader sets the pace |
| Physician | pin + stepped stamp | a decision is discrete, so the motion is discrete |
| Drips | interactive bench (no scroll trap) | choosing, comparing |
| Peak | long pin + scrubbed push-in + level + crossfade + report slide | the one scrubbed film |
| Six steps | sticky stack | steps are sealed one on another |
| Vitals | in-view demo, then direct manipulation | proof by touch |
| Routes | short pin, stream drawn along two lanes | two routes, one dose |
| Zones | form, staggered ledger | quick to use |
| Price | bars grow, one slider | a number you can feel |
| Questions | glide accordion | never jumps |

## Revision 2 (2026-11-24): more scroll in acts 2 and 3, and the merge
Asked for: "2 to 3 section need more scrolling effect in top, and merge ingredient animation is must, but unique."
- **Act 2 (statement)** now has depth. Five real glasses scatter at different depths (near ones larger and faster, two sit behind the text and photo) and drift as the sentence is read; as it finishes they gather into one ordered row on a shelf line and "run like a clinic" arrives. The photo opens, scales down and drifts. The hero copy also lifts away and fades as you leave it.
- **Act 3 (physician)** is four sheets in a pile (Declines, Asks for more, Changes the doses, Approves). Each decision is stamped by the wheel (the stamp slams as you scroll into it, it is not a timer) and the sheet is then flung off the card. The card tilts in 3D with the scroll, and a huge outline line of the four outcomes slides behind it. It ends on Approves, which leads straight into the merge. "Not for everyone" now opens the act, on Declines.
- **The merge (new act, `#merge`, 720vh)** is the signature move for ingredients. The bag arrives and fills with the base fluid. Then each ingredient, in its own glass from the data, rises off a shelf, slides under the bag's port, docks, and its colour blooms up into the carrier while the bag's label writes the dose line down (the label becomes the ledger). The liquid colour is the sum of what went in and ends on the drip's own colour. Anything marked separate never moves: it stands in a dashed box beside the bag. It uses the drip picked in the formulary, so the merge changes with the choice.
- Why this is not "ingredients fall into a bag": the unique parts are the shelf and the lane (the glass travels, it does not fall), the label as ledger, the colour as a running sum, and the separate glasses that refuse to merge.

## Revision 3 (2026-11-24): a new peak, a different merge, real textures
Asked for: the evening, bag and morning peak is not needed here (the drip page already has it); the bottle-into-port
merge is the same as the drip page's; make the merge and the scrolling different and unique, with realistic 3D
images and better textured backgrounds.
- **Removed:** the evening, bag and morning peak (`#session`) and the shelf-to-port merge (`#merge`).
- **New peak, "Follow one dose" (`#dose`, 980vh):** one continuous journey from stills. The camera pushes into the
  chosen drip's bag and dips under the liquid's surface (a moving wave edge). Inside the carrier each ingredient
  drifts in from the dark in its own glass, names itself, lets its colour go as a photoreal ink cloud and dissolves;
  the clouds spiral into one and the carrier takes the drip's colour ("Six ingredients. One Myers' Revive.").
  Anything given separately stays outside the bag. An iris closes onto one drop at the drip chamber, the camera
  tilts down the line to the arm and pushes into the cannula, and a second iris opens on the bloodstream, with cells
  rushing past. A route rail (Bag, Carrier, Line, Arm, Blood) tracks the stage. It carries "Illustration, not to
  scale." as the data requires.
- **Why it is not the drip page's move:** nothing falls into a bag, there is no port docking and no stand. The merge
  happens inside the liquid, as colour, and the act follows the dose past the bag to where it goes.
- **Textures:** the statement act stands on a real plaster wall whose window light drifts as you scroll; the
  physician's card lies on a linen desk with leaf shadows that drift. The hero planes follow the pointer as well as
  the scroll.
- New assets and their sources: `ASSETS.md`.

## Revision 4 (2026-11-24): one take, smoother, more 3D, sharper
Asked for: some sections lag; the scenes should merge "in one go", not look like different sections; more 3D,
higher resolution, more animated.
- **One camera move:** everything after the bag is one WebGL canvas (`dose-gl.js`, hand-written, no library). Each
  scene melts into the next through a noisy, refracting edge in the direction the camera is already moving: the
  liquid rises over the bag, the drop opens out of the point where the colours met, the arm rises under the drop so
  the tube carries straight on, and the bloodstream opens out of the cannula. The act starts on the page's paper
  and ends by opening into it, so it flows out of the drips and into the six steps.
- **3D and motion:** a volume of 3D particles flies at the camera through every scene change (motes, bubbles, red
  cells, sparks in the drip's colour), the liquid has animated caustics, the ink swirls in the shader, the vessel
  breathes, and the ingredients' glass tilts in 3D. All of it runs on a clock while the act is on screen. The
  statement's glass floats too.
- **Smoother:** pinned acts are measured once (and when the page's height changes), never during a scroll;
  progress glides toward the scroll position; reads happen before writes; the heavy CSS blend modes and per-frame
  clip-paths are gone. Headless, a fast full-page scroll went from 14 slow frames to 3.
- **Sharper:** all generated images upscaled 2x; journey plates at 2560 px, with 1600 px versions for phones.
- **Seams:** the plaster and linen grounds fade into the colour of the next section.
- Without WebGL, the act shows its still version.
- (2026-11-25) The way in is now a zoom, not water rising from the bottom: the camera pushes into the bag's liquid
  under the label, and the water opens out of that point under a refracting rim, in the bag's own colour, then
  clears to the base fluid before the ingredients arrive.
- (2026-11-25) The drip chamber is alive: the photograph's frozen drop is painted out in the shader and a real one
  is drawn as a lens (the lamp behind it upside down, a dark fresnel rim, a specular highlight, a trace of the drip's
  colour). A drop is always beading at the tip, swelling and trembling; the one that lets go falls stretching,
  hides behind the connector, shows through the clear chamber wall and lands in a splash bead and rings. One drop
  every 1.9 s, on the act's own clock.
- (2026-11-25, later) The drop is driven by the scroll (about four across the scene, reversing if you scroll
  back) and keeps dripping slowly on its own when you stop. It now behaves like a real drop: a bead swells into a
  bulb on a neck that thins and pinches off; it falls fast, round and wobbling, with a satellite droplet; the bead
  left at the tip bounces back. The cone under the drop is kept exactly as photographed.
- (2026-11-25, later) The photograph's centre drop is no longer painted out: the column (nozzle, drop, cone) stays
  as photographed, and that drop breathes. The real drip now happens where an IV drip chamber drips: from the tip
  of the inner tube into the pool below, seen through the clear chamber wall. The camera tilts down to it sooner.
- (2026-11-25, later) Checked against real drip-chamber photographs: the generated image had an exposed drop
  between the nozzle and a connector, which no real giving set has. Replaced with an anatomically correct chamber
  (spike connector with vent cap, drop-former tip inside the top of a clear chamber, half-full pool, outlet tube).
  The drop forms on that tip, about 4.5 mm across (a 20 drops/mL drop), and falls into the pool inside the
  chamber. The camera opens on the chamber, then follows the outlet tube down into the arm.
- (2026-11-25, later) The scene opens on the whole drip set (bag neck, spike connector, vent cap, chamber, tube),
  centred below the header, and eases in while it drips. Chamber to arm is now one tilt: the chamber's picture
  slides up and out while its tube carries on down the centre, and the arm's picture arrives from below with its
  own tube lined up under it (nudged on phones), so the chamber never sits on the skin.
- (2026-11-25, later) No stretched pixels at that seam: the two photos overlap by a strip both really cover (the
  chamber photo's last rows, the arm photo's first), the tilt's travel is worked out each frame from where each
  photo's edge falls on screen, and the crossfade happens only inside that strip.
- (2026-11-25, later) The tube is matched across the join: measured on the photos (chamber outlet 0.0201 wide at x
  0.484; arm tube 0.0092 wide at x 0.4317), the arm camera's zoom and centre during the tilt put its tube on the
  chamber's at the same width and place (trimmed against the rendered frame: 53-55 px all the way through at
  1920 wide, centre moving smoothly), so the crossfade is one tube. After the join the camera pulls back to show
  the arm on the recliner, then pushes into the cannula, where the bloodstream opens.
- (2026-11-25, later) The join dissolves over a third of the screen (was a sixth), so the dark room becomes the
  warm one gradually instead of along a line; and the arm photo is rolled 2.8 degrees about the join so its tube
  continues the chamber's in a straight line (measured row by row in the rendered frame: centre moving 952 to 940
  px, width 53-54 px, no jump), easing back to level as the camera pulls away to the arm.
- (2026-11-25, later) The chamber and arm photos no longer carry the time-based "heat-haze" wobble (it made the two
  tubes drift against each other inside the dissolve; a plastic tube should not shimmer anyway). It stays on the
  carrier liquid and the bloodstream. Held still, six captures over four seconds are pixel-identical; the join was
  then re-trimmed (arm tube x 0.4321): width 52-56 px through the join, centre moving 1-2 px per 40 px row.
- (2026-11-25, later) The bloodstream now opens where the catheter enters the skin under the dressing (arm photo
  0.456, 0.63), projected through the arm camera every frame, instead of at the screen centre (which had put it on
  the plastic connector in mid-air). The camera's push-in aims at the same point.

## Authored silence
The statement act holds still between the last word and the sentence under it. The peak holds on the full bag for a beat before it starts to drain.

## Data notes (not resolved by me)
- The data says "a 16-point health quiz" in the main message, "sixteen markers" in the session text, and "21 questions in five parts" for the quiz. I used **21 questions** and the five parts everywhere a number was needed, kept "sixteen markers" only where the data's own session text says it, and dropped "16-point" from the hero line (the meaning is unchanged). Please decide which is true.
- The quiz link is `/quiz`, so it works once this folder is served beside the app; opened from a file it is a dead link.
- Batch numbers are never shown as values (none are in the data): the report card says "batch number recorded".
- The tube from the bag to the arm in the peak is a drawn line over the photograph, the one non-photographic mark on the page. It can be taken out in `index.html` (`#pkTube`) without touching anything else.

## Verified (headless Chrome, 2026-11-24)
Desktop 1440 × 900, tablet 1024 × 768, phone 390 × 844, phone sideways 667 × 375, reduced motion. No console errors, no horizontal overflow at 390 or 1440. All interactions exercised (goal chips, compare, pincode yes / limited / no, cancellation slider, price ladder jump, vitals, locked step, FAQ). LCP 0.6 to 0.8 s locally; CLS 0.001 desktop, 0.004 phone. Not verified: a real phone's touch scrolling and GPU, Safari, Firefox.

## Revision 5 (2026-11-25): one go into "Six steps", and the app's labels
- No blank screens after the bloodstream. The paper opens a little sooner (`exit` 0.955 to 0.99 of the pin), and How it works slides up over the end of the dose act (`.how`, `--how-ov`: negative margin, clear where the two overlap), so "Six steps. None skipped." rises out of the paper at about 98% of the pin instead of a screen and a half later. Still mode and the no-WebGL fallback keep the old spacing.
- The ingredient labels are now the app's own (`src/components/site/v3/glass.ts` and `styles/glass.css`, chosen by the user from the live landing): NutriDrip™ and IV NUTRIENT THERAPY, the name on its colour band with the vitamin under it ((C), (B6), (B12), as the drug master records them), the dose with the same amount one unit up ("7,500 mg (7.5 g)", derived, never invented), the band-coloured rule, the client's ∞ and "For IV Use Only"; the ampoules carry their neck ring in the band's colour. Same band palette and fit (the Outfit width table, 172 of 196 px). The label is laid out at 196 px and scaled to the glass in CSS (`.glass` is a size container; `--k: tan(atan2(100cqi, 196px))`), so it needs no script. A richer "pharmacy" label (Rx, 2D code, batch fields) was tried and dropped at the user's word; the app itself was not changed.
- Outfit (SIL OFL) is loaded for the labels and preloaded, since the hero's two glasses carry them.

## Verified (headless Chrome, 2026-11-25)
1903 × 915 and 390 × 844 through the end of the dose act; the bench and the floating glasses at 3x for every drip (each band within its 172 px). No console errors, no horizontal overflow at 390. CLS 0.0001 to 0.0009. LCP: phone 0.58 to 0.92 s; desktop 0.6 to 1.7 s, swinging with load on this machine (two dev servers running). The first layout costs the same with and without the label containers (A/B: about 450 ms in both, most of it the page's existing start-up and WebGL shader linking in headless software GL).

## Revision 6 (2026-11-25): the hero, "light through the drip"
The user asked for a hero that does not look like the app's home page (headline left, bag on a stand by a recliner) and chose this one of four ideas. The revision-5 page is kept as `Nutridrip/backups/home-v5-preview-2026-11-25.zip`.

- A sunlit plaster wall (`tex-plaster.webp`, the statement act's wall, so the two acts run on as one wall). The bag is above the frame and shows only as its shadow: outline, seams and ports dark, the clear body light (`bag-shadow.webp`, built from the bag photo's fine detail, not its opacity), with the cord above and the line and drip chamber below, a drop falling through the chamber.
- The light through the liquid falls on the wall in the drip's own colour: a tinted body and moving caustic light pooled low in the bag (`caustic.webp`, two layers drifting by whole tiles, masked by `liquid-mask.png`). It is all CSS: no WebGL, nothing blurred live, the motion is transforms.
- The nine drips are chips under the copy, each with its colour. Pointing at one (or focusing it) turns the light to that drip and shows its name, price and time; choosing one chooses it for the whole page (the hero bag's label, the bench, the dose act).
- The hero is a short pin (185vh, phones 170vh): scrolling tilts the camera up, the wall slides down and the bag comes into view hanging up and to the left of its shadow, the label set from the chosen drip (`bagHTML`). The copy fades as the bag arrives (sooner on phones, where the bag comes down over it). The wall's foot dissolves into the paper, and the statement act's wall follows.
- Still version (reduced motion, phones held sideways): the tilt has happened, copy and bag both shown on desktop; phones keep the light and leave out the bag; held sideways, the light moves to the right edge.
- Every layer of the light blends with the wall, so they share the wall's stacking context: nothing between them may take a transform, translate or opacity (`.hl` is centred with `left` for that reason).

### Verified (headless Chrome, 2026-11-25)
1903 × 915, 1920, 1440, 1024, 768 and 390 × 844, reduced motion (desktop, phone), 667 × 375. Chips: hover, leave, click and keyboard focus all behave; no console errors; no horizontal overflow. CLS 0.0001 (desktop), 0.0007 (phone). LCP: phone 0.66 s; desktop 0.92 to 1.0 s with a warm browser (1.8 s on the very first launch, which pays the browser's own GPU start-up); no slow frames scrolling the page on a warm desktop.

### Revision 6, later the same day (from the user's screenshots of the scroll)
- The bag now has its own drip chamber and line under it (`.hb-set`), as its shadow does: clear glass, the drip's colour pooled at the foot, a drop that falls in step with the drop in the shadow (both start together). The line hangs down through the frame and comes in with the bag; the bag and its chamber stay fully above the frame until the tilt.
- The headline no longer drifts down and lingers half-faded beside the bag: it lifts slightly and is gone by about 42% of the pin (phones 21%).
- The empty wall left of the bag at the end now holds the chosen drip, from its data: its tag, name, carrier, time and price, description, and "See what goes in" (to the drips bench). Phones put it under the bag, left of its line, without the description. Hidden in the still version, which shows the headline instead.
- Verified again at 1903, 1440, 390 and 360 wide, reduced motion and sideways; chips unchanged; no errors. LCP warm desktop 0.70 s, phone 0.81 s; CLS under 0.001.

### Counts come from the data (2026-11-25)
The user pointed out that "nine" was written into the page, while the admin can add, retire or remove drips. Every count is now worked out from the data, as the app does (`word()` in `home/format.ts`): the drips heading, the hero's label, the "All …" goal chip and the goal line from the drips and goals; the zone count in the booking note, the zones lede, the FAQ and the pincode answer from the zones. Labels that need no number have none ("The drips" in the header and footer, the skip link, the rail's label). Marked up as `[data-count]` and filled at start. Tested by taking one drip and one zone out of the data: every mention read eight and 13. The 29-step checklist is a clinical rule in code, not admin data, and stays written.

## Revision 7 (2026-11-25): the hero, every drip on a turning ring
The user did not like "light through the drip" and chose the ring from four new ideas. (It was not backed up separately; its generated images, `caustic.webp`, `bag-shadow.webp`, `liquid-mask.png`, and `tools/gen_light.py` stay in the folder, unused.)

- Every drip in the data is its real bag (`bagHTML`: its colour, its label) hanging by a wire hook from a ring rail in front of the plaster wall, however many drips there are. app.js places each bag every frame: on the rail's ellipse, smaller and fainter toward the back, turned a little toward its side, swinging on its hook as the ring turns. The rail is drawn twice (its back half behind every bag, its front half in front of the back ones); the cables it hangs from fade out above it. Soft floor shadows under each bag. Nothing moving is blurred.
- The bag in front names itself under the ring: its number of the total and tag, name, carrier, time and price, and "See what goes in" (chooses it and goes to the bench).
- Turning it: drag or swipe (it follows, coasts and settles on the nearest bag), the arrows, a click on a bag (brings it round by the shorter way), Tab to a bag, the arrow keys. Clicks, arrows, keys and drags choose the drip for the page (the bench and the dose act follow); choosing a drip in the bench brings it round too. Left alone it steps on by one drip every 3.4 seconds; hovering or touching pauses it for 8.
- Scroll (a short pin, 160vh; phones 150vh) turns it a quarter and raises the camera, opening the rail's ellipse.
- It fits itself round the copy as laid out: on wide screens in the space right of the headline and paragraph, on phones under the button, drawn smaller if the height is short. Phones hide the "15-minute call" line to make room.
- Still version: the ring stands still and turns only when asked (instantly).
- At rest between steps nothing is redrawn.

### Verified (headless Chrome, 2026-11-25)
1903, 1440 (and reduced motion), 1280 × 720, 1024 × 768, 768 × 1024, 390 × 844, 360 × 740, 667 × 375. Every way of turning it tested (idle step, arrows, click, drag, keyboard, hover pause, "See what goes in"); no errors; no horizontal overflow. CLS under 0.001. LCP with no scroll (the front bag): desktop 0.72 to 0.78 s, phone 0.82 to 1.12 s warm (2.0 s on the very first cold launch). Scrolling the whole page on a warm desktop: no slow frames.

### The bag's label, as the app prints it (2026-11-25)
From the user's reference (the app's build bag): every labelled bag on the page (the ring, the bench, the dose act, the close) now carries the app's label exactly (`Landing.tsx` build bag, `home.css` `.build__label`, `glass.css` `.bl-*`): NutriDrip™ and IV NUTRIENT THERAPY, the drip's name in capitals on its colour band, two columns of the carrier and every dose that goes in the bag (a dot in the drip's colour on each; a name without its bracketed vitamin, as the drug master writes it), "Given separately: …" when something goes beside the bag, then the rule and ∞ | the volume. All from the drip's data; the carrier and volume are read from its base. The label now sits in the bag's clear body (19.5% to 79% of its height), so the dose act's push-in starts at 83.5%, in the liquid under it. The bench rewrites the whole label when a drip is chosen, and its bag takes the drip's colour.
- (later) The label follows the bag's shape, from the user's close look at it: a flat rectangle with a drop shadow stood over the bag's rolled side edges like a card. Now it is printed on the film: its sides are drawn in along the inner line of the rolled edge (the outline inset by 6.5% of the width), so it hugs the waist and widens with the bag below; corners rounded; a soft shade where it turns away at its sides; the bag photo multiplied over it, so the film's creases run across the print; no drop shadow. `images/label-mask.png` and `label-shade.png`, made by `tools/gen_label_mask.py` from `bag-mask.png`.
- (later) A refresh starts at the top: the head of `index.html` turns off the browser's scroll restoration and, on a reload, drops a #section left in the address by a menu click; a fresh visit to a #section link still goes there. Tested after scrolling, after a menu link, and with a fresh link to #price.

## Revision 8 (2026-11-25): the statement, zoom through "treat."
The user chose this from three ideas for the second section (it had five floating glasses that settled on a shelf, and the IV-line photo opening from a sliver).
- The sentence lights up word by word, set wider (three lines). Its full stop is a drawn dot. It swells a little, then the camera dives into it: the dot becomes a window (a circle cut, `clip-path`, a true circle at every size) onto the next act's desk, the linen with its leaf shadows at true size, while the words scale about the dot and fly past the camera, drawn again at each size so they stay sharp. The window grows at a steady rate of zoom until it covers the screen; then "IV nutrient therapy, run like a clinic." and its line arrive on the desk, over a soft pool of paper so they read over the shadows.
- No seam into the physician act: it is pulled up beneath the statement (`.doc` margin `-100dvh - 40vh`, the statement above it), so when the dive ends it is already pinned behind, on the identical linen. Over the last 40vh of the statement, measured from the real scroll position: the answer lifts away, then the statement's desk dissolves into the one beneath, bringing "A doctor, before a needle." and the card in. The two texts never overlap.
- Removed: the floating glasses, the shelf, the IV-line photo (`images/ivline.webp` stays in the folder, unused). The statement no longer runs on a clock.
- Still version: the sentence, then the answer on a rounded linen card below it; no overlap.
- Verified at 1903 × 915, 1440, 390 × 844 and reduced motion; no errors, no horizontal overflow. Scrolling through the dive: no slow frames on a warm desktop or phone. LCP unchanged (desktop 0.8 to 0.9 s, phone 0.7 to 0.8 s warm).

## Revision 9 (2026-11-25): the statement, a sealed sterile pouch
The user liked the zoom through "treat." but asked for something different, and rejected a gift-wrapped bag ("it's a medical thing": no gifts, treats or menus, even as a contrast). Chosen: opening a sterile pack, a real clinical ritual.
- A photograph of a sealed sterile peel pouch on the table, a coiled IV infusion set inside, the words on the empty table to its left. The sentence lights up word by word; then the pouch's clear film peels back from its seal down to its foot (the empty paper it uncovers is a second photograph of the same pouch; a soft roll of film along the peel line and the lifted film above it are drawn in CSS); the IV set lifts off the paper toward you (a cut-out, its shadow staying behind, softer); then "IV nutrient therapy, run like a clinic." arrives under the statement (on phones in its place).
- The photograph is placed in its own proportions, the pouch three quarters of the height under the header and 70% across, its edges melting into the table colour; on phones smaller, under the words.
- The handover into the physician act keeps revision 8's overlap: the words lift away first, then the scene dissolves into the act beneath. The zoom (the drawn full stop, the lens, the linen desk inside it) is gone.
- Still version: the pouch open, the set lifted, the statement and the answer together; on phones the pouch under the words.
- Verified at 1903 × 915, 1440, 1024 × 768, 390 × 844 and reduced motion; no errors, no horizontal overflow. Scrolling through it: no slow frames on a warm desktop or phone. LCP desktop 0.68 to 0.83 s, phone 0.61 to 0.65 s warm (1.2 s cold).

## Revision 10 (2026-11-25): the statement, the sterile field
The user found the pouch too simple and asked for something out of the box, the whole section rebuilt if needed; chose "the sterile field" from three ideas.
- The sentence lights up on the table and lifts away. A surgical drape drops in folded in four and opens in two real folds (four quarters in CSS 3D, each a window on one drape photograph, shaded as they turn), covering the stage below the header.
- The session's things then land on it one by one, in checklist order, each settling onto its own shadow: the sealed kit, the anaphylaxis case, gloves, the chosen drip's own vials (its data, the app's labels, lying on their sides), the blood pressure cuff and the vitals monitor, a capped syringe, the tourniquet, tape, the chosen drip's bag (its full label), gauze, the sharps container; then a printed card: "IV nutrient therapy, run like a clinic.", its line, and "Everything on this field is a step on the nurse's 29-step checklist."
- Every thing is a real step of the nurse's checklist, copied from the app (`src/lib/clinical/checklist.ts`): pointing at one, focusing it or tapping it lifts it (its shadow spreads) and names the step beside it ("The anaphylaxis kit · Step 8 of 29 · Confirm the anaphylaxis kit is present and in date", with the step's detail where the app has one). The count is the checklist's length. Choosing a drip anywhere on the page puts its bag and vials on the field.
- Wide screens lay the things out in rows with the card bottom-left, a little larger on very wide screens; phones in a portrait arrangement, the card at the foot (its title and the hint).
- The handover keeps the overlap: the card lifts away first, then the field dissolves into the physician act beneath.
- Still version: the sentence, then the finished field below it. Nothing moving is blurred.
- Verified at 1903 × 915, 1440, 1024 × 768, 390 × 844 and reduced motion; hovering and tapping; no errors, no horizontal overflow. Scrolling through it: no slow frames on a warm desktop, at most one on a phone. LCP desktop 0.75 to 0.81 s, phone 0.74 to 0.95 s warm (1 to 1.7 s cold).

## Revision 11 (2026-11-26): from the sterile field into the physician act

The user approved the sterile field, then asked for the move from it into the physician act to be better. It had been a crossfade: the field and the physician act showed through each other for a moment, and the first stamp ("Declines") came down while the field still covered it, so nobody saw it.

- The handover is now one physical move, over 120vh in which the physician act is pinned beneath the statement (`.doc` margin, `staMeasure`, `staFn`). The field is cleared by its own landing played backwards, the card first, then each thing in reverse checklist order. The statement's ground goes. The drape folds back up where it lies, bottom half up and then right half across, so each fold uncovers half of what is left of the physician act. No text of the two acts is ever on screen together. The folded drape is then lifted and carried off the top, its shadow (`.sf__lsh`, a gradient, not a blur) rising more slowly than it so the gap reads as height. "A doctor, before a needle." is the last thing uncovered.
- It runs on the act's smoothed progress, like every other act, not on the raw scroll position, so a wheel's steps are one motion.
- The physician act waits unstamped until the field is gone (`doc.pre`), and the first stamp comes down just after, in view. Its dots allow for the wait. Both acts grew by 80vh so the field and the four stamps keep their pace (`.sta` 560vh, `.doc` 560vh; 520vh on phones).
- The printed card leaves with a small lift as it fades. Full size, it would grow past the screen's width on a phone.
- Fixed on the way: the stamped sheets, invisible once flung off the card, still covered the 1–4 dots and took their clicks. They now take none.
- Verified at 1903 × 915, 1440 × 900, 1024 × 768 and 390 × 844, scrolling down and back up, with reduced motion (unchanged: the finished field, then the physician act), and each dot clicked with the mouse on desktop and phone. No errors, and no horizontal overflow at 360 to 1920. The handover has no slow frames on any run. The only slow frames were on a cold first load, earlier in the field's own unfold, as before.
- Fixed later the same day (the user spotted it): a hairline across the middle of the open drape, and a fainter one down its centre. The drape is four quarters in 3D, and they met at a fraction of a pixel. The browser softens each quarter's edge on its own, so a thin line of what lies beneath showed through. Each face now reaches 1px past its quarter, with the photograph moved by the same pixel (`.sf__f`, `sfMeasure`), so the quarters overlap on the same cloth. Measured on the seam row against the cloth beside it: 17.5 down to 2.1 at 1903 × 915, 16.9 down to 2.2 at 1440 × 900 on a 1.25× screen, and 24 down to 1.3 on a 390 px phone (3×). The folds look as before.

## Revision 12 (2026-11-26): the statement's opening, the drape waiting on the table

The user found the statement's opening empty: the sentence on the left third of a bare ground for all the time its words light up. (The 29-step checklist, the obvious thing to put there, is already the Safety section's interactive piece, so it is not repeated here.)

- The drape now waits there from the first frame, folded in four on the table, with a soft shadow (`drape-sh.webp`). It lies beside the sentence on a wide screen, and under it, turned to lie across, on a tall one, as large as the free space allows (`sfWait`). It is the thing the next beat opens, so nothing new is introduced and nothing appears from nowhere.
- As the words lift away (a little sooner than before, so the drape never crosses them), the drape is picked up, its shadow dropping away beneath it, slid into the middle and set down (turning a quarter on a phone), and opens as before. It no longer fades in.
- Its photograph is decoded while the page is idle (`app.js`, at start-up), so its first paint does not land on a scroll frame.
- Checked at 1903 × 915, 1440 × 900, 1024 × 768, 768 × 1024 and 390 × 844, and with reduced motion (unchanged: the sentence, then the finished field). The open drape is exactly as sharp after scrolling through the growth as when jumped to. No errors, and no horizontal overflow at 360 to 1920. Scrolling through the statement and the handover: no slow frames on a warm desktop or phone over three passes. A cold first visit has one 67 ms frame as the statement starts, plus the scattered ones in the landing that were there before.

## Section 3 options (2026-11-26)

The user asked to redesign section 3 next ("A doctor, before a needle."). As it stands it is a web card beside copy: for about 3.5 screens of scroll only the small stamp slip changes, and a thrown slip flies across the heading. Asked to choose a direction, the user wanted to see HTML previews first, so three standalone previews are in `options/` (`options/index.html` links them). They share `opt.js` (one eased scroll loop and the data, copied from `app.js`) and `opt.css`, and use the build's stylesheet, fonts and images:
- A, `a-desk.html`, the physician's desk: the linen table from above. The drip's own protocol (its doses, the quiz's five parts) is read down with a ruler, each line ticked in pen. A real rubber stamp then comes down four times on a pad of decision slips, and each slip is torn off and laid on the protocol.
- B, `b-roads.html`, one decision, four roads: an ink diagram on chart paper. The answers run down to the physician, and the scroll travels each road: declines (it ends), asks for more (back to you), changes the doses and approves (on to the bag).
- C, `c-upgrade.html`, today's design upgraded: the same card and copy, with a real stamp coming down on each sheet, grainy ink, a gummed pad, and torn sheets flying off to the right instead of across the heading.
Checked at 1903 × 915 and 390 × 844: no errors, no horizontal overflow. The chosen one is to be built into `index.html` and joined to the sterile field's handover.
- Added the same day, at the user's request ("brand new concept, keep A B C"): three new, shorter concepts (about two screens each), built around what only this section says: a real, registered doctor, named on your report, who can say no. A, B and C are kept.
  - D, `d-signed.html`, signed, by name: the session report on the linen. The camera moves in on its physician block, where the name and registration number print in (placeholders that say so; no invented name or number) and the protocol is signed in ink.
  - E, `e-no.html`, a doctor can say no: type only. A reel of what the quiz screens for (pregnancy, renal failure, cardiac failure, certain drug interactions, as the page's own "Not for everyone" lists them), each marked "a physician declines", stops on everyone else: approved, 90 days.
  - F, `f-call.html`, fifteen minutes: a phone on the table, on a call with your physician. The scroll runs its clock from 0:00 to 15:00 beside the quiz's five parts; the call ends and the protocol is signed.
  Checked at 1903 × 915 and 390 × 844: no errors, no horizontal overflow.

## Revision 13 (2026-11-26): section 3 is option B, one decision, four roads

The user chose option B from the six previews in `options/` (A to F stay there). The physician act is now an ink drawing on chart paper:
- **The drawing.** "Your answers" (the quiz's question and part counts) runs down to "Physician" (registered with the KMC). The scroll then travels each road in the order the page names the decisions, with a dot for your protocol and each road in its status colour as it is travelled. Declines ends ("No drip."). Asks for more loops back to you. Changes the doses and approves both go on to the bag.
- **The copy beside it.** It changes with each road: the decline quote and "Not for everyone", the ask-for-more line with the drip whose description asks for a ferritin result (from the data), and so on.
- **The code.** `app.js` draws a wide and a tall version (`docBuild`) and runs it (`docFn`). It keeps the handover's wait (`doc.pre`), so nothing draws until the sterile field has been carried off.
- **The still version** shows the whole drawing with every road, the words, and the "Not for everyone" note.
- **Removed:** the old card, the sheets and stamps, the dots, the ghost line and the linen, with their styles and code. Copies of the three files from before this change are in the session scratchpad.
- **Checked:** 1903 × 915, 1440 × 900 and 390 × 844, through the handover; reduced motion on desktop and phone. No errors and no horizontal overflow at 360 to 1920. No slow frames on a warm desktop. On a phone, the one slow frame is in the sterile field, as before.

## The port into the app (2026-11-26)

The user asked to integrate the preview into the app's home page, after backing up the current one (`backups/nutridrip-home-before-v5-port-bf93d4b.zip`, and this folder as `home-v5-section3-roads-2026-11-26.zip`). The home page work is not finished, so this folder stays the place the page is designed. After any change here, run `npm run home-port` from `nutridrip-new/` to bring it across (`scripts/port-home-v5.mjs`). The script writes:
- `src/components/site/home/v5/port/`: the markup, the stylesheet scoped to `.sc-site .hv5` in `@layer site`, the script as `mountHome(root, data)` → `destroy()`, and the dose renderer as a module.
- `public/site/home/`: the images and fonts.

The route (`src/app/(site)/page.tsx`) renders `HomeV5` with `getHomeData()` (`src/lib/data/home-v5.ts`): the real drips, goals, served zones (with their hours in the app's clock format), FAQ and late-change policy, passed in place of `window.NUTRIDRIP_HOME`. Changes made here for it:
- **Data hooks.** `app.js` reads `window.NUTRIDRIP_HOME` when given, and falls back to its own copy, so Live Server still works. The price range, the late window and the late fee in the markup are `[data-fill]` spans.
- **WebGL.** `dose-gl.js` can give its context back (`dispose`).
- **A bug fixed.** The section-3 parts list had overwritten the quiz link (`QUIZ`).
- **Phones.** The drips heading stacks on phones.

Checked on the dev server: every section at 1440 × 900, phone and reduced motion. Leaving by a client-side link and coming back leaves nothing running (the same animation-frame count on /drips either way) and rebuilds the page once. No errors; typecheck, lint and 828 tests pass. The old landing (`src/components/site/home/Landing.tsx`, `motion.ts`, the v3 `home.css`) is no longer imported. It is still in the repo, and the backup zip holds it too.
- Later the same day: no picture on the page can be picked up and dragged any more. The user saw the browser's ghost copy of an ingredient's vial lying over the bag. It is stopped with `-webkit-user-drag: none` on images, and a `dragstart` cancel on the page for Firefox. The port script now matches regardless of formatting (Prettier reformats the preview on commit) and formats its own output, so a re-port's diff shows only real changes.
- And: the text printed on every vial, ampoule and bag (their labels) can no longer be selected (`user-select: none` on `.glass` and `.bag`). The names and doses written under them still can.

## Section 4 options (2026-11-26)

Three previews for the drips section, in `options/` (linked first on `options/index.html`). They run on the page's own drips and the real labelled vials and bags: `options/kit.js` is built from `app.js` by `options/make-kit.mjs`, so re-run that after changing the data or the glass code. `s4.js` and `s4.css` hold what the three share: the heading, goal chips, compare, the drip's card and the compare table.
- **A, `s4-a-exploded.html`:** the exploded view. The bag sits in the middle of a drawing board, and each ingredient is laid out round it with an ink leader to the bag. What goes beside the bag sits apart. Switching drips gathers the ingredients back into the bag and lays out the new ones.
- **B, `s4-b-matrix.html`:** the formulary matrix. Drips run across the top and every ingredient down the side, with a dose mark sized within its row (hollow for beside the bag). A tinted band slides to the chosen column, and that drip opens below. Compare keeps only the picked columns.
- **C, `s4-c-cases.html`:** the kit cases. Each drip is a closed case with its printed label. Opening one lifts the lid on its hinge, and the bag and vials sit in foam cut-outs. Switching drips closes the lid, repacks the case and opens it again.

The small heading reads "The formulary" rather than "The menu" (drips are never a menu item). At the user's word, the first goal chip is now just "All", and the "Nine drips, six goals." line under the chips is gone; both changes are already in the page.
Checked at 1440, 1024 and 390: no errors, no horizontal overflow.
- Asked for more different ideas, three more options turn "every ingredient in view" into something physical you do:
  - **D, `s4-d-compound.html`, the compounding bench:** a pinned scroll act. The carrier hangs clear, and each vial on the tray in turn lifts, travels over the bag, tips and pours. The drops fall, the liquid takes the drip's colour, the level rises, and that line prints on the bag's label. What goes beside the bag stays on the tray, apart. This is the site's signature move (the drip assembling itself, AGENTS.md).
  - **E, `s4-e-wall.html`, the pharmacy wall:** one bin per ingredient, with the drips hanging on a rail below. The chosen drip's bins slide out with their doses, and dashed lines run down to its bag. Pointing at a bin lifts every drip that takes it, with its dose.
  - **F, `s4-f-loupe.html`, the loupe:** the drips lie on a lit table, too small to read. A pharmacist's loupe magnifies the real printed label under the pointer (dragged with a finger on a phone). Clicking the bag under it opens that drip. On a phone the table is three by three.
  Checked at 1440 and 390: no errors, no horizontal overflow.
- The user's decision: section 4 stays as it is (the six options stay in `options/` for reference). One word changed, following the rule that drips are never a menu: its small heading now reads "The formulary" instead of "The menu".

## "Same dose, two routes" options (2026-11-27)

The user asked for the IV-or-tablets section's layout and picture to be improved. Now: two horizontal tracks beside a small stock-style photo of loose tablets. Three previews in `options/` (first on `options/index.html`), sharing `rt.js` (the page's own stops, word for word) and `rt.css`:
- **A, `rt-a-map.html`, the route map:** a textbook line plate of the body (`rt-body.webp`, new). As you scroll, the drip's blue line runs up the arm into the blood while the tablet's gold line is still working down through the stomach, small intestine and liver. The two lists beside it light up in step.
- **B, `rt-b-diptych.html`, the diptych:** a full-height split, the tablets on one side and the arm with its drip on the other (both existing photos), each with its own route list.
- **C, `rt-c-stream.html`, the stream:** both routes as flows of particles leaving at the same rate. The tablet's thins at each of its three stops; the drip's reaches the blood whole. It is a canvas, still under reduced motion, with no numbers.
Checked at 1440 and 390: no errors, no horizontal overflow.
- The user liked A and asked for it to be better; the first version is kept as `options/rt-a-map-v1.html`. A now:
  - The figure is a framed textbook plate ("Fig. 1 · the same dose by two routes · not to scale").
  - Both routes show as a faint dotted preview ahead of their lines.
  - The tablet's dot pauses at each organ. Its gold line runs thinner after the small intestine and again after the liver, with a few specks falling away (no numbers).
  - A pulse goes out from the chest when the drip arrives, and a gold one when the tablet does.
  - Two cards (gold and blue) replace the lists. Each shows its route's current stop in large type, its sentence, and progress dots.
  - On a phone the cards are compact and every label stays on screen.
  Checked at 1920, 1440 and 390: no errors, no overflow.

## Revision 14 (2026-11-27): "Same dose, two routes" is the route map

The user chose option A (second version). It replaces the section's two tracks and the photo of loose tablets:
- **Markup:** `#routes`, `.rm`.
- **Styles:** `8. IV OR TABLETS: the route map`.
- **Script:** `rtFn` and `rmMeasure`, with the stops word for word as before.
- **Images:** `rt-body.webp` is new; `tablets.webp` is no longer used on the page, though it stays in `images/`.
- **Still version:** the finished map, with both cards at their last stop.
Checked in the preview and on the app (port re-run) at 1440 and 390, moving and still: no errors, no horizontal overflow. Typecheck and lint pass.
- Later the same day: the user saw the cards flicker when their text changed. The text faded to nothing and was swapped after a pause, and a sentence of a different length changed the card's height, so the card below jumped. Now:
  - **One cell:** every state's text is stacked in a single cell, so each card keeps one height (measured through the whole scroll: one height, one gap, at 1440 and 390).
  - **Rolling:** inside a clipped window, the old stop slides up and out while the new one slides in. Both stay at full strength, so nothing is ever faint or blank, and scrolling back reverses it.
  - **Progress strip:** the colour strip on each card's left fills with its route's progress.
- Asked whether the figure could look like a real 3D human: `options/rt-a-map.html` now has a switcher (Line drawing / Porcelain / Glass, `?fig=`), with the routes placed on each body's own mouth, stomach, gut, liver, heart and arm vein. The live page still uses the line drawing until the user chooses.
- The user chose **Glass**. The page's route map now uses `rt-body-glass.webp`, with the routes placed on its own organs and the arm vein, the lines lifting off it on white halos, and the blood label to the left of the heart. Ported to the app. Checked at 1440 and 390, moving and still, preview and app: no errors, no overflow, and the cards keep one height with the text at full strength. The line drawing and the porcelain figure stay in `images/` for `options/`.
- Fixed (2026-11-27): on every load in development, the top of the page flickered once. React's development double-mount called the port's destroy(), which puts the served markup back, so the hero was rebuilt and its opening animations restarted. `HomeV5.tsx` now waits one tick before tearing down, and a mount that comes straight back to the same element with the same data keeps the running script. Measured: the hero markup was replaced once per load, now never. Leaving the page still cleans up fully (the same animation-frame count on /drips either way).
- Then, from the user's screenshots: the heading rose in and the ring popped in later. In the app the page's script runs only after React loads (0.3 to 1.5 s after the heading paints, longer in development), so the ring's entrance had already played on an empty ring. The app's wrapper now starts as `is-waiting` (the ring and its caption unseen). Once the script has built them, `ring-late` lets them rise and fade in together. The preview is unaffected. Both classes were added to the port's wrapper list (`scripts/port-home-v5.mjs`). Measured on a slowed cold load: the ring was visible while still empty for 6 samples, now 0.
- Then (the user): "the text shows immediately after refresh, and the right side after 2 or 3 seconds". On the app the ring was built only once React had loaded. That was measured on a production build too: 0.4 to 0.9 s after the heading on a fast computer, about 2 s with the CPU slowed 4×. Now:
  - **The boot script:** the port also writes the page script as a plain, minified browser script (`public/site/home/home-v5.boot.js`, 80 KB, versioned in `port/boot.ts`). `HomeV5` puts the page's data and that script at the end of its own markup, so on a page load the browser runs them as it reads the page and the ring is built before the first paint. On a client-side navigation React sets that HTML with innerHTML, where scripts never run, so `HomeV5` loads the script and mounts the page itself (the ring then waits unseen and enters late). If the boot script has already mounted the page, `HomeV5` adopts it.
  - **What waits until after the first paint:**
    - Most of the first build: the bench, the dose act, the sterile field's bag and vials, and the closing bag (`selectRest`, run just after the paint at start-up; later picks still update everything at once).
    - The bench itself, which is only built when first seen (`benchSeen`).
    - The dose act's WebGL, created after the page has loaded (compiling its shaders took about 0.4 s).
    - Prices now use one shared formatter (`INR`), set up once.
  - **Production numbers (1440 × 900; fast, and with the CPU slowed 4×):**
    - First paint: before 0.63 to 0.84 s and 1.56 to 1.77 s; now 0.79 to 1.05 s and 1.39 to 1.85 s.
    - Ring: before 0.4 to 0.9 s after the heading (popping in); now with it.
    - LCP: 0.94 s cold and 0.74 to 0.78 s warm on desktop; 1.07 s cold and 0.75 to 0.85 s warm on a 390 px phone.
    - CLS: 0.003 and 0.002.
  - **Still holds on dev and production:** the hero is never rebuilt on a reload, the ring is never shown empty, nothing keeps running after leaving, and phones and reduced motion work.
  - **Checks:** typecheck, lint, 828 tests.
- Then (the user): the ring was there at once, but the heading was still revealing itself line by line from behind a mask, so the first moment showed slivers of letters, and the paragraph and button faded in 0.75 to 0.9 s later. The whole top section now arrives as one piece: heading, paragraph, button, ring and caption are all visible from the first painted frame and settle up 18 px together (`@keyframes settle`, 0.9 s, no delay, no mask, no fade from nothing). The per-line `rise`, `ringin` and the delayed fades are gone. `HomeV5` adds `ring-late` (the ring's fade-in) only when the page script had to be fetched after an in-site navigation. Filmed on a reload: the first painted frame shows everything together.
- Then (the user): "but now you removed animation from text". The line-by-line heading reveal is back, and the ring now moves with it instead of arriving complete beside half-shown text: the lines rise from their masks (0.1 s start, 0.08 s apart, 1 s) while the ring lowers into place on its cables, fading in from 0.1 s over 1.25 s; the paragraph, button and ring caption follow (0.45 to 0.55 s), all done by about 1.4 s. This replaces the shared `settle` of the entry above. Reduced motion now also drops animation delays (`animation-delay: 0s`). Filmed on a reload: both sides start and finish together. Production: LCP 0.91 s cold and 0.74 to 0.75 s warm on desktop, 0.67 to 1.16 s on a 390 px phone (the element is the hero's plaster ground, so the ring's fade does not affect it); CLS 0.002. Reloads, navigation, phone and reduced motion unchanged.
- Then (the user, a reload screenshot): the first screen flickered. The page painted a pale screen with the heading in a stand-in font, and the wall, the bags and the font each changed it as they arrived. The cause was that the port copies only the preview's `<body>`, losing the head's preload lines. Fixed:
  - `port-home-v5.mjs` now writes `port/preloads.ts` from the preview's head: the wall textures, `bag-empty.webp` and the Newsreader fonts.
  - The home route asks for them, and for the boot script, at its start, before any `await` (React drops preloads asked for after one).
  - The wall has its own average colour (`#d2ccc0`) until the texture arrives.
  - The ring's bags show only once the bag photograph is ready (`.ring.has-glass`), so they no longer flash as flat coloured shapes.
  Measured on a 6 Mbps connection, uncached: the texture arrives 0.4 to 0.5 s after the first paint (before: 1.4 to 1.8 s), and the heading's font before or about when it paints (before: up to 1 s after).
