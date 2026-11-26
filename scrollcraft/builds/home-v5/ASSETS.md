# Assets: home-v5

## Supplied by the client (unchanged)
`bag-empty`, `bag-hero-clean`, `vial-vitc-blank`, `vial-calcium-blank`, `ampoule-blank`, `room`, `prep`, `ivline`, `tablets`, `mark.svg`.
`bag-mask.png` and `vial-cap-mask.png` are masks derived from those photos (from `public/site/v3`).

## Generated for this page (2026-11-24)
kie.ai, model `google/nano-banana` (4 credits each, 36 credits in all; balance 52 before). Gemini's API was tried first per
AGENTS.md and has no free image quota on this key (limit 0 on every image model). Generated images carry no
watermark; kie.ai output is licensed for commercial use under its terms. No text, logo or label in any image.

| File | What it is | Processing |
|---|---|---|
| `dose-liquid.webp` | Inside the clear carrier: bright surface, bubbles, light shafts | cropped to 16:9 (bag seams removed), 1920 wide, light unsharp |
| `dose-drop.webp` | A drop at the tip of an IV drip chamber | 1920 wide |
| `dose-arm.webp` | A forearm on a linen armrest, small taped cannula, the line going up | 1920 wide |
| `dose-vessel.webp` | Photoreal 3D render inside a blood vessel, red cells | 1920 wide |
| `dose-cells.webp` | Red blood cells on black | alpha from the brightest channel, colour un-premultiplied |
| `ink-a.webp`, `ink-b.webp` | White ink blooming in water, on black | surface band cropped; luminance made into alpha; recoloured in CSS per ingredient |
| `tex-plaster.webp` | Limewash plaster wall with window light | 1920 wide (statement act) |
| `tex-linen.webp` | Linen desk with window and leaf shadows | 1920 wide (physician act) |

Scripts: the session scratchpad `gen/` (`kie2.mjs`, `prep.py`). Sources (PNG) are not kept in the build.

## The drip chamber, redone (2026-11-25)
The first `dose-drop` image was anatomically wrong (an exposed drop between the nozzle and a connector). It was
replaced by an accurate one: bag port, white spike connector with an air-vent cap, a clear drip chamber with the
drop-former tip inside its top, the chamber about half full, the outlet tube below, and no drop (the drop is
drawn live in `dose-gl.js`). kie.ai `google/nano-banana` (4 credits; a second candidate made with
`google/nano-banana-edit` was rejected for a wrong fluid level), upscaled with `recraft/crisp-upscale` (0.5).
Saved at 2688 px (desktop) and 1600 px (`-m`). Balance after: 3 credits.
Structural reference only, not used on the page: a crop of the drip chamber from Pexels photo 4421491
(free licence; the full photo carries printed bag labels, so it is not shippable as is).
Measured on the new image: drop-former tip x 0.4848, y 0.432; fluid surface y 0.530; chamber inner walls
x 0.437 to 0.536.

## The arm, one line (2026-11-25)
The generated arm photo showed a second tube leaving the tape and running down off the armrest; a home infusion
has one line, from the drip into the cannula. It was retouched out locally (no credits): its centre line was
tracked from the photo's own brightness ridge, then a band along it was filled by mirroring the photo across each
edge of the band and blending the two, so skin texture and shading run through. Script: scratchpad
`gen/untube.py` (`track.py` for the path). The untouched upscale is kept as `up/arm-orig.png` there.
Redone the same day (`gen/untube2.py`) because the camera pushes in on the cannula and the mirrored fill showed as a
crease: the band's shading is now a smooth gradient between the blurred photo just outside each edge, with only the
fine skin grain added back from beside the band; the band follows the tube's real width and runs to the tape.

## The arm, replaced (2026-11-25, later)
The retouch above still showed a ghost of the second tube once the camera pushed in, so `dose-arm` was replaced by a
new image with exactly one line: an arm on the linen armrest of a recliner at home, a taped cannula, one clear tube
rising straight up out of frame. kie.ai `z-image` (0.8 credits; nano-banana's 4 were not available), upscaled with
`recraft/crisp-upscale` (0.5) to 2560 px, then graded warmer and lower-key with a soft vignette to sit under the drip
chamber (`gen/grade_arm.py`). Candidates rejected: four free Pexels photos (3845115, 6753446, 6010930, 6129691), all
hospital settings with gowns, gloves, monitors or branded labels. Measured: the tube enters the top edge at x 0.470;
the cannula hub is at (0.508, 0.444). Balance after: about 1.7 credits.

## The arm, regenerated on nano-banana (2026-11-25, after a top-up)
With 10 credits, two candidates were made with `google/nano-banana` (8 credits): an evening-lamp version (rejected:
it added a second line running down to the left) and a late-afternoon window-light version (used): one clear tube
rising straight up to a small taped cannula, a recliner's linen armrest, a softly blurred living room. Upscaled with
`recraft/crisp-upscale` (0.5) to 2688 px; no grade needed (already warm and low-key, mean 75). It replaces the
z-image version above. Measured: the tube enters the top edge at x 0.430; the connector hub is at (0.452, 0.53).
Balance after: 1.5 credits.

## High-resolution pass (revision 4)
Every generated image was upscaled 2x with kie.ai `recraft/crisp-upscale` (0.5 credits each, 4.5 credits in all;
15.5 → about 11 left), then saved again: the four journey plates at 2560 px (desktop) and 1600 px (`-m`, phones,
chosen in code), the textures at 2400 / 2000 px, ink masks at 1200 px, cells at 2000 px.

## Fonts added (2026-11-25)
`fonts/outfit-latin-wght-normal.woff2` with `fonts/OFL-Outfit.txt`: Outfit, SIL Open Font License 1.1, copied from `../home-v3/fonts/` (the same file the client's design uses). Used only for the labels on the glass, as the app sets them.

## The hero's light (revision 6, 2026-11-25)
Made by a script for this build (`tools/gen_light.py`, run as `python tools/gen_light.py images`; own code, no third-party shaders or images), from the build's own files:
- `caustic.webp` (512 × 512, tileable): caustic light, white on black, from two layers of warped cellular edges.
- `bag-shadow.webp`: the bag's shadow on the wall, from `bag-empty.webp`'s fine detail (its outline, seams and ports) and `bag-mask.png`.
- `liquid-mask.png`: where light passes through the liquid, `bag-mask.png` inside its seams, softened.
- `tex-plaster-m.webp`: `tex-plaster.webp` at 1280 px for phones.

## The bag label's shape (2026-11-25)
`label-mask.png` and `label-shade.png`, in the bag photo's frame (577 x 1200), made by `tools/gen_label_mask.py` (own code) from `bag-mask.png`: where the label is printed (its sides following the inner line of the bag's rolled edge) and the shade at its sides.

## The sterile pouch (revision 9, 2026-11-25)
kie.ai, on a second account (80 credits before, 69.5 after: 10.5 spent). On the first account, 9.6 more went on two rejected `z-image` drafts (0.8 each; they came out as zip-lock bags), the closed pouch (`google/nano-banana`, 4) and a failed "remove the film" edit (`google/nano-banana-edit`, 4; it returned the same picture).
- The sealed pouch with the IV set inside: `google/nano-banana` (4, first account).
- The same pouch, open and empty: `google/nano-banana-edit` of it (4).
- The IV set alone, same place: `google/nano-banana-edit` of it (4); background removed with `recraft/remove-background` (1).
- All three upscaled 2x with `recraft/crisp-upscale` (0.5 each).
`tools/gen_pouch.py` (own code) makes the page layers from them: `pouch-plate.webp` (and `-m` for phones), `pouch-open.webp` (the uncovered paper, colour-matched), `pouch-set.webp` (the set, its colour neutralised so the clear tubing reads clear on white paper), `pouch-shade.webp`. No text or marks in any image. `ivline.webp` is no longer used.

## The sterile field (revision 10, 2026-11-25)
kie.ai, 61.5 → 58.5 credits on top of the drape (69.5 before this section, 58.5 after: 11 spent).
- The drape: `google/nano-banana` (4), a blue-green surgical drape top-down with its fold creases; upscaled (0.5).
- The instruments, in one photograph so the light and scale agree: `google/nano-banana` (4), knolling on a plain grey ground; upscaled (0.5); background removed with `recraft/remove-background` (1). Retouched by hand first: the monitor's screen is blank and a line of made-up lettering under it was painted out (no invented readings or text). The syringe's needle is inside its cap.
- The sealed kit: the revision-9 pouch, background removed (1).
`tools/gen_field.py` (own code) splits the instruments into one cut-out each (by connected shape, named by where it lay), with its own soft shadow, and writes `field-drape.webp` (and `-m`), `field-<item>.webp` and `field-<item>-sh.webp`. The revision-9 pouch layers (`pouch-plate`, `pouch-open`, `pouch-set`, `pouch-shade`) are no longer used.

## The folded drape's shadow (2026-11-26)

`drape-sh.webp` (2.5 KB): a soft-edged rectangle drawn by `tools/gen_drape_shadow.py` (own code, no generation, no credits). It is the shadow the folded drape casts on the table while it waits beside the statement and is slid into place.

## The rubber stamp, for the section 3 options (2026-11-26)

- `doc-stamp.webp`: a walnut rubber stamp seen from above, generated with kie.ai `google/nano-banana` (4 credits; no text, no logo, no ink), background removed with `recraft/remove-background` (1 credit). 5 credits in all; 53.5 left on the key.
- `doc-stamp-sh.webp` (its shadow) and `ink-grain.png` (the speckle that makes stamped ink look printed): `tools/gen_doc_assets.py` (own code).
Used by the option previews in `options/` (A and C); kept for whichever is built.
