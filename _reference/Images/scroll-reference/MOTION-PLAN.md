# Drip assembly: motion plan

The signature move for `/` and `/drips/[slug]` (see `AGENTS.md`). The
`perkform-*.png` frames beside this file show the reference sequence in scroll
order. Match how it **moves**; never copy PERKFORM's look, copy or palette.
It is another brand.

## What the reference does

| Frame | On screen | Built with |
|---|---|---|
| 01 | "TWO DRINKS." Two products far apart, each with a small caption, a "+" between | Pinned stage; two alpha cutouts; HTML captions |
| 02–03 | They slide to the centre and overlap; captions and "+" fade | Scroll-driven translate |
| 04 | Both shrink to a point inside a thin accent ring | Scale to ~0; an SVG circle closes around the point |
| 05 | The product grows out of the point; the new headline arrives faintly behind | A different asset scales up from the same point; headline swap |
| 06 | The product turns, with a specular streak crossing it | The only 3D-looking moment |
| 07 | Front-facing again; two short cards rise from the corners | HTML cards |
| 08 | A real-life photo rises behind; the product is now grounded in a scene with a time stamp | Photo plate slides up behind the pinned product |

No frame of it is generated video. Cutouts, one ring, one swap, all driven by
scroll progress.

## NutriDrip version

The carrier (normal saline, 500 ml) **is** the bag, so it is never a vial. The
vials are the other ingredients of that drip: for Myers' Revive, six (ascorbic
acid, magnesium sulphate, B-complex, B12, calcium gluconate, pyridoxine). Every
count, name and dose comes from the Drip document.

| Step | On screen | Built with |
|---|---|---|
| 1. Spread | Headline from the data, e.g. "Six ingredients." Each ingredient apart on the stage, in its real container, with its name and dose beneath as real text | One premium alpha still per container form (ampoule, vial; see "The ingredients must look as real as the bag"); HTML labels and captions; pinned act. The layout holds 3 to 9 ingredients |
| 2. Converge | Vials travel inward in turn, not all at once; captions fade as each one leaves | Page-local code on the engine's `--sc-p`, one staggered path per vial |
| 3. Collapse | Vials shrink into one point; a thin ring in `--color-primary` closes around it | Scale to ~0; SVG ring. Never a clinical status hue |
| 4. Emerge | The 500 ml bag grows out of the point; the headline becomes the drip's name, e.g. "One drip. Myers' Revive." | Alpha bag still (blank label); HTML/SVG label with drip name, `500 ml`, `LogoMark` and wordmark, composited on the bag |
| 5. Fill | Liquid inside the bag settles to full, with "500 ml" shown | SVG liquid layer clipped to the bag's inner shape. A fill always shows its number |
| 6. Turn | A slight turn (about ±20°) with a light streak sweeping across the plastic | 2.5D: CSS `rotateY` on the bag plus a moving highlight layer. Real 3D (Three.js) only if this falls short; a flat bag never needs a full spin |
| 7. Callouts | Two short cards rise from the corners | HTML, copy from `content.ts` and the Drip document: duration, given at home by a nurse, physician-approved. No invented claims or numbers |
| 8. Grounded | A home photo rises behind; the bag now hangs on an IV stand beside a sofa, an evening time stamp, then the quiz call to action | Licensed photo plate from `site-images.ts` or a new one; the bag stays pinned and lands on the stand's hook |

## Rules for the move

- **Honest proportions.** The actives are milligrams in a 500 ml carrier. Do
  not imply each vial adds a visible share of the volume; the liquid settles
  to 500 ml once, as the carrier.
- **Readable without motion.** The full ingredient list is real text in the
  DOM. Under `prefers-reduced-motion`, show step 5 (the bag with its label)
  with the list beside it, and skip the travel.
- **Phones are composed separately.** Spread the vials in a two-column grid
  rather than shrinking the desktop row, and keep the bag at least half the
  viewport height at step 5.
- **Speed.** No blur or `backdrop-filter` on any moving layer; the ring, the
  liquid and the streak are transforms and opacity only.
- **Verify** every step with `shoot.mjs`: the merge has to read at each
  intermediate scroll position, not only at the start and end.

## The bag must look premium, not stock

The first prototype (`scrollcraft/builds/home/`) used a front-lit bag on white
with a flat grey label rectangle and an HTML label laid over it like a
sticker. It read as a stock photo. The reference can reads as premium because
of lighting and layering, not its shape. The bag needs the same:

- **Light it like a high-key product hero.** The page stays in the site's
  white UI, so the bag must hold its own against white (see the last point
  for the dark option). Clear plastic
  on white reads by dark reflections, not rim light, so the reference is studio
  glass photography: black-card reflections defining both edges and the seals,
  one crisp specular strip, a soft contact shadow and a faint floor
  reflection. Never flat and front-lit like v1. Show the liquid by its
  meniscus, refraction and the graduation scale; do not invent a colour the
  real drip may not have. Set the stage on a soft paper-to-`--color-surface-2`
  gradient rather than pure white, so the bag never dissolves into the page.
  Generate on a light neutral grey sweep (not pure white), so edges and
  highlights survive the cutout; v1's `tools/prepare-assets.mjs` handles the
  flat-field and true-alpha steps. High resolution, generous margins, nothing
  cropped.
- **Make the label look printed, not stuck on.** Layer order: bag body, then
  the HTML/SVG label, then the bag's own sheen and highlights as a separate
  alpha layer *above* the label. The gloss crossing the print is what makes
  it read as printed under the plastic. The label follows the bag's bulge with
  a slight perspective, and its edges sit inside the seal, not on it.
- **Brand it properly.** A primary-colour header band with the `LogoMark` and
  wordmark, the drip name large, then the composition as small print (every
  name and dose from the Drip document), `500 ml`, and "For intravenous use".
  A printed graduation scale (100 to 500 ml) runs down one edge as SVG. Never
  invent lot numbers, expiry dates, barcodes or registration numbers.
- **One reflection sells the turn.** In step 6, a dark edge reflection and a
  bright specular band sweep across the plastic as it turns; on white, the
  dark band is the one the eye sees. Both are transforms on alpha layers,
  never a blur.
- **White page; the assembly section may go dark.** The page keeps the site's
  current white UI (paper, ink, `--color-primary`). The assembly section alone
  may hard-cut to a deep ink ground, but only if it looks better. The user
  decides at the bag checkpoint, from the same bag and label shown on both
  grounds. On dark, the edges read by rim light instead of black-card
  reflections. If one cutout cannot serve both, generate a variant lit for
  that ground. Either way, the sections before and after stay white.
- **Generate several, keep one.** Make two or three bag candidates, inspect
  each at 100% over the real ground, and reject any with garbled marks,
  impossible ports or a cropped edge.

## The ingredients must look as real as the bag

The vials and ampoules get the same standard as the bag: real glass, premium
light, no clip-art. v1's floating vials were soft, generic and blurred.

- **Each ingredient in its real container.** The form is recorded on the stock
  lots (`BatchLot.unitForm`: Vial, Ampoule, Bottle, …), not on the drip. Take
  each ingredient's form from its master's current lots, the most common
  `unitForm` among unexpired ones, falling back to Vial when there are none.
  Read only the form: never show a batch number, lot or expiry on the page.
- **One premium still per form actually used.** For the seeded drips that is
  a glass ampoule (scored neck, liquid line visible) and a glass vial (rubber
  stopper, aluminium crimp, flip-off cap). Add a form only when a drip uses
  it. Each has a blank label area and true alpha.
- **One shoot, one light.** Generate the containers and the bag in the same
  session from the same style preamble: the same key-light direction,
  reflections, contact shadow and colour temperature. Placed together, they
  must look photographed on one set. Keep the relative scale real (an ampoule
  is smaller than a vial), not one size for all.
- **Labels are generic and honest.** A container label carries the ingredient's
  name as HTML, printed under the glass sheen like the bag's label. No
  NutriDrip logo, because NutriDrip does not make these drugs; no invented
  manufacturer, strength, barcode or lot. The dose in this drip goes in the
  caption beside the container, never on its label: one dose can take more
  than one vial, so a strength on the label would misstate it.
- **Caps stay neutral.** Flip-off caps and stoppers stay grey, white or silver,
  never a clinical status hue, and never a colour per ingredient as decoration.
- **Sharp while moving.** Depth comes from scale, overlap and the contact
  shadow. No CSS blur on moving containers; if a depth-of-field look is
  wanted, bake it into a separate still, as v1 did.
- **Inspect at 100%.** Reject any candidate with warped glass, a stopper that
  does not seat, a cap that floats, garbled marks or a cropped edge. Show the
  chosen containers next to the bag at the bag checkpoint, on the same
  ground.
