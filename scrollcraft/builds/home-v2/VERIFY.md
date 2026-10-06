# Verification: landing v2 prototype (checkpoint 3)

Served by `serve.mjs` on :4610 from this folder. Data baked from the dev
database (`tools/export-drips.mjs`, `tools/bake.mjs`).

## Harness (`shoot.mjs`)

| Run | Page length | Dead scroll | Sheet |
|---|---|---|---|
| 1440×900 | 14.4 vh | none | `lab/shots/sheet.png` |
| 390×844 | | none | `lab/mobile/sheet.png` |
| reduced motion | | none | `lab/reduced/sheet.png` |

The harness samples pinned acts only; the white sections were checked from
full-page captures (`lab/full-1440.png`, `lab/full-390.png`).

## The assembly, ten evenly spaced positions

`lab/strip/strip.png` (1440×900) and `lab/strip-390/strip.png` (390×844):
spread, convergence, ring and point on ink, the bag emerging with its label,
the fill with its readout, the turn, the callouts, the room with the bag on its
stand, 7:00 pm and the quiz.

Reduced motion (`lab/reduced-asm.png`): no pin, no travel; three still frames:
the hero, the filled bag with its full list beside it, the room with the CTA.

## Checked

- No horizontal overflow at 1440 or 390.
- No console errors (one 404: the favicon).
- The time stamp is the served zones' last bookable slot (19:00), the zone
  count is live (14), every name and dose comes from the Drip document.
- Close panel copy reveals on entry (the blank in the full-page capture is a
  capture artifact: opacities read 0.92 to 1.0 once scrolled into view).

## Not verified yet

- 768, 1024 and 1920 widths; keyboard order; contrast measured by the harness
  on the room frame; LCP and CLS. All before or during the port.
- A real phone.
- The room photograph is daylight under an evening time stamp; a dedicated
  evening plate needs a generated image (KIE has 10 credits left).
- The cancellation FAQ shows a bracketed placeholder; the route fills it from
  the Billing page.
- The how-it-works pictures for steps 1 and 4 are text notes here; the port
  keeps the live `QuizMock` and `ReportMock`.
