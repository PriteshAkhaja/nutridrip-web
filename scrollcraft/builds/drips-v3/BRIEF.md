# Drips list (`/drips`) v3: brief (2026-11-03)

Step 3 of the public-site redesign: after the landing and IV vs Tablets (ported 2026-11-02) and each drip's page (ported 2026-11-03).

The client's design has no page of its own for the list: their "Drips" link goes to the landing's formulary, the rail of drip cards under "What exactly is in it?". This page is that formulary laid out as a grid, under the site's page heading (the one IV vs Tablets uses). It keeps what the list page already does: the goal filter and the search.

## Decisions (the user's, 2026-11-03)

- **"Bag cards, like home."** Each drip is the landing's formulary card: the bag in the drip's colour, name, goal, time, price, every ingredient with its dose, what is given beside the bag, and the link to its page.
- **The admin's photo wins.** "If admin uploads an image from the Admin panel, instead of our bag show that image."
  - A drip with an uploaded photo (Admin → Site images, its own slot) shows the photo in the bag's place, on this page and on the landing's cards.
  - The shipped stand-in photos are never shown. A drip without an upload shows the bag.
  - On a drip's own page, an upload shows in the hero, under the description; the bag stays and still fills as the list is read (the user's choice).
  - No drip has an upload today, so the prototype's photo examples use two shipped stand-ins, marked as such (`test/photos.html`, `drip-v3/test/myers-revive-photo.html`).
- **"Prototype the big ones."** This page is prototyped and approved before the port. FAQs and Legal will be restyled in the app directly.

## Defaults (mine; say if any is wrong)

- **Treatment: Light** (AGENTS.md): the visitor is comparing. The cards show at once: no scroll reveal on the grid, no pinned act. Changing the filter glides the cards that stay to their new places. Only the closing band reveals as it enters.
- **Goal chips** only for goals that have a drip, each with its count.
- **Search** as today: name, goal or ingredient, every word anywhere. The filter and the search are in the URL, so a filtered list can be shared.
- **Stock** on a card only when it is low or out, as on the drip page ("Only 2 left today", "Out of stock").
- **No photo panel at the end.** It closes with "Not sure which?" (the landing formulary's own close): the quiz, and "Ask a clinician". The `drips.closing` photo slot retires at port, as the drip page's did.
- **No invented copy.** Counts, goals, prices, times and doses come from the drips.

## Feeling

| Part | Feeling | Cause |
|---|---|---|
| Heading | Oriented | How many drips, and that every dose is shown |
| Chips and search | In control | One tap narrows the list, and the count says what is shown |
| Grid | Able to compare | The same card for every drip, every dose in the open |
| Close | Not on your own | "Not sure which?" hands the choice to the quiz and a physician |

**Peak:** none engineered (a Light page). The one moment is the grid: nine bags in nine colours, every dose readable without opening anything.
