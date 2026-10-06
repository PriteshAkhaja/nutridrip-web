# /safety: the checklist works itself through

**Scope (user, 6 Oct 2026):** "add GSAP where required, not in all sections".
`/safety` is a Full page in AGENTS.md, and it has no moment of its own. One
section gets one: **"The 29 steps"**. The hero, the six commitments, the
reference bands, the contraindications and the close stay exactly as they are.

Creative direction delegated ("yes continue" to the audit's proposal).

## The page's feeling curve (existing sections, one changed)

```
Hero              Seriousness   "Where the safety actually sits", a nurse taking vitals at home
Six commitments   Trust         six plain promises
The 29 steps      RESPECT (peak) the list is worked through under your hand: each step ticks as you read it, the phase bars fill with it
Reference bands   Precision     the numbers that stop a session
Contraindications Candour       who we turn away
Close             Resolve       not emergency care; the quiz
```

**The peak.** *"I scrolled the checklist and it ticked off every step as I read it,
and the four phase bars filled up beside it."* It turns the page's central claim
(the nurse cannot skip a step) into something the reader does.

**Tell-someone sentence.** *It's the page where the safety checklist fills in
as you read it.*

## The device

Progress follows reading. No pin: the list scrolls as it does today. A reading
line at 45% of the screen drives one value through the list (GSAP ScrollTrigger,
0.35 s scrub, so it glides rather than steps):

- **Steps above the line:** ticked (a check in the accent replaces the number).
- **The step at the line:** a pale accent row behind it.
- **Steps below the line:** as they are now, fully readable.
- **The sticky card beside the list:** its four phase bars fill segment by
  segment, the current segment by the fraction read, each with its "x / total".
  Every unfilled segment is the same grey (user, 6 Oct: three lighter
  segments for the optional steps read as broken). Which steps are mandatory
  stays where it is clearest: the "Mandatory" label on each row, and the 26 in
  the paragraph above.
- **Phones:** the card is not sticky there, so a slim strip sticks under the
  header while the list is on screen: the phase, "step n of 29", one bar.

Clinical hues stay out of it: the progress is the brand accent (as the card's
bars are today); "Mandatory" keeps its existing label. Every number is from
`CHECKLIST_STEPS`. Moving parts are `transform` (bars) and colour changes on
rows; no height or layout animation.

**Reduced motion / no JavaScript:** the section exactly as it is today.

**Different from the home and drip pages:** no pin, no imagery, no scene; the
document itself is the stage.
