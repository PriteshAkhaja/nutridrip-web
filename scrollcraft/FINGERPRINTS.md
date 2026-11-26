# Fingerprints

Every site you build with **scroll-craft** gets one row here, appended after it
ships. The registry exists so your next build can prove it is a different page
rather than a re-skin of one you already made.

This file is **yours**. It starts empty on purpose: the gate is about not
repeating *yourself*, so it has nothing to say until you have built something.

The rules and the gate live in the skill's
`references/uniqueness.md`. Short version:

**A new build must differ from EVERY row below on at least 4 of the 6
dimensions.** Four against each row individually, not four on average across the
table. If a planned build fails, change the plan. Never edit a row to make room
for it.

The six dimensions are: **grammar**, **nav treatment**, **hero device**,
**act-sequence shape**, **close pattern**, **signature move**.

Dimension 6 is free, because a signature move is unique by definition. So the
gate really asks for three more out of the remaining five, and a build that
changes only grammar and world will fail it.

---

## The registry

| Build | Grammar | Nav treatment | Hero device | Act-sequence shape | Close pattern | Signature move | World | Port |
|---|---|---|---|---|---|---|---|---|
| `nutridrip-site` (2026-11-02, the client's design; one row for the whole public site, pages not gated against it) | The visitor's questions, answered in order: each section is one question ("What is this?" … "Ready to book?") | Fixed pale bar: wordmark, page links, a question ledger ("3/10 Which one is for me?") that ticks questions off as they are read and opens their list | Layered planes over a sunlit infusion room: blurred bags behind, the NutriDrip bag (photo, print in HTML) in front, a near plane; mouse parallax; the headline recedes behind the bag | pin (hero) → flow (figures) → pin (six steps, a line between circle centres) → reveal → parallax pair → scrub (drip chamber clip) → long pin (the build) → pan (every drip, a rail) → pin (the day, a timeline) → flow (cost, refusals, FAQ) | A booking slip carrying the drip being read, and the health quiz | The chosen drip built on screen: each ingredient's own ampoule or vial (from the Drip document) falls into the bag, the liquid rises per ingredient, the label prints its doses, then the page floods with the drip's tint | Client photography (room, prep table, bags, glass), Outfit and Geist, black buttons, a green accent on a pale ground | `src/app/(site)/page.tsx`, `src/app/(site)/iv-vs-tablets/page.tsx`; chrome in `src/components/layout/SiteChrome.tsx` |
| `home-v5` (2026-11-24, a standalone preview of the home page, not ported; gate vs `nutridrip-site`: 5 of 6; rev. 6 and 7 replaced the near-matching hero) | The clinical chart: the page is a record that fills in as you scroll, one entry per act | Plain fixed paper bar: wordmark, five links, the one button; no ledger or counter | (rev. 7, 2026-11-25) Every drip on a turning ring: each its real bag, colour and label, hanging by a hook from a ring rail before the plaster wall; drag, swipe, arrows or a click turn it, the front bag names itself; scroll turns it a quarter and opens it | pinned hero (the ring) → pin (rev. 10: the sterile field; words, a drape unfolding in 3D, the session landing on it in checklist order, every item a real checklist step on hover) → pin (physician card, stepped stamps) → interactive bench (nine drips, compare) → **long pin (the peak, rev. 3: "follow one dose", bag → carrier → line → arm → bloodstream)** → sticky stack (six case notes) → in-view vitals demo (dark) → table reveal → short pin (two routes) → form (pincode) → bars + slider (price) → accordion → close | The same room with the drip chosen earlier hanging in it, the quiz in five parts, one button | (rev. 3) Follow one dose: push into the chosen bag, under the surface, each ingredient's glass releases its colour as an ink cloud and the clouds spiral into the drip's colour; separate ones stay outside; irises into one drop and through the cannula into the bloodstream | Client photography, unchanged; Newsreader (serif), Geist, Geist Mono; paper and ink, a drip's own colour the only colour | none (`scrollcraft/builds/home-v5/index.html`) |

*(empty: your first build has nothing to clear, so build whatever the interview
points at. From the second onwards, this table is the constraint.)*

---

## What is taken

Add a bullet here whenever a build claims something a later build should avoid
reusing: a grammar, a nav treatment, a close pattern, a signature move, an
act-count-and-length band. The shared columns are what the next build inherits
as a constraint, so writing them down is the whole point.

Nothing is taken yet.

---

## Appending a row

After shipping, add one line to the table and one bullet to **What is taken** if
the build claimed something new. Fill every column. Say what the build shares
with existing rows.

Rows are append-only. A build that has been superseded stays in the table,
because the space it occupies is still occupied.

---

## Worked example

The skill's author kept a registry of twelve builds across eight page grammars.
If you want to see what a filled-in table looks like, and which shapes tend to
collide, read `EXAMPLES.md` in the scroll-craft repository. Treat it as
illustration only: those rows are somebody else's builds and they do **not**
constrain yours.
