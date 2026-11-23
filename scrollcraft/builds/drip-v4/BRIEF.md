# /drips/[slug] v4: the build stage (2026-11-20)

Authored from the client's change request and the user's answers; not a new interview.

## The client's brief
The "What's inside" area becomes three steps on scroll:
1. **Scrolling injection.** The drip's ingredient bottles stand on the left (the empty area the client boxed in red) and, one by one, go into the bag. The list on the right scrolls one ingredient at a time and gives each enough scroll time.
2. **The drip attaches to the IV stand.** The v2 home-page scene (evening living room, bag on the stand, the last bookable time), after every ingredient is in.
3. **The patient feels energised.**

For every drip page, from the Drip document.

## The user's answers
- Ingredients go into the bag by scrolling (not a syringe animation).
- Step 3 uses a **generated** picture of a person looking energised. This departs on purpose from "only real photographs of people"; the user chose it knowing that.
- Step 3's words are based on each drip (its own benefits).
- Phone: stacked layout.

## Feeling curve
1. Reading each ingredient and watching it go in: curiosity, then trust (the dose is on the bag as it lands).
2. The hung bag in the evening room: calm, "this is happening at my home".
3. The morning after: relief and lift. This is the peak, and it is the end of the page's story.

## How it is built
- One `section.bs`, height = 100svh + units x 52svh, a sticky pin, progress read from the section's own scroll. Weights in `build-math.ts`: carrier 0.6, in-bag ingredient 1, given-separately 0.7, act 2 2.2, act 3 1.8, so a longer drip gets more scroll and every ingredient keeps its time.
- Act 1: shelf of real bottles (`glassHTML`) left, bag centre with the real label printing a line as each lands and the liquid rising, list right in a masked window that glides to the active row. A bottle given separately moves beside the bag and stays, with its caption.
- Act 2: the room fades in under the bag, which flies to the stand's hook (ring on the hook, damped sway). Caption: the last bookable time, the real zone count, the home page's physician-call wording.
- Act 3: the morning image crossfades in; `benefits[0]` is the headline, the others follow. A drip with no benefits ends on act 2.
- Still version (reduced motion, screens under 500 px tall, before the script runs): the list and the full bag, then both pictures with their words, one after another. Nothing is hidden.
- Phone: stacked (shelf strip, bag, list window), captions above the sticky quiz bar.
- Pure arithmetic is unit-tested in `tests/drip-build-math.test.ts`.

## Open
- **Step-3 pictures are a placeholder** (`public/site/v3/feel/default.webp`, the v2 room brightened). The generated people need a KIE key (none in `.env`); plan is one image per goal in `src/lib/feel.ts` `BY_GOAL`: same living room in morning light, no stand, no visible IV, no text, nobody identifiable.
- Show the user for approval before treating it as final.

## Update, 2026-11-23

The step-3 placeholder above is gone: the page went live with generated
pictures (the evening with the nurse, and a morning picture for Energy,
Hydration, Immunity and Skin). Their sources and licence are in ASSETS.md.
