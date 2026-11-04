# Drip page v3 (`/drips/[slug]`): brief (2026-11-02)

Step 2 of the public-site redesign (the landing was step 1, ported on
2026-11-02). Same site, same chrome, the client's design
(`scrollcraft/lab/client-artifact/REVIEW.md`, `PAGES.md` §1c).

## The eight topics, from what is already decided

1. **Vibe.** The client's design: pale ground, black buttons, Outfit and Geist, the NutriDrip™ wordmark. It is a calm page you read, beside a bag.
2. **The journey, in the client's order** (`drip-glow.html`): the drip and its price → what is inside → the tests → the session → course and price → questions → book.
3. **Energy.** Quiet throughout. One lift: the bag filling as the list is read.
4. **The moment to remember.** Chosen by the user (2026-11-02): "Client's bag + our bottles". The client's sticky bag fills as you read each ingredient. Our labelled bottle for that ingredient drops into it, the liquid rises, and the count shows ("3 of 6").
5. **What no other site does.** You read the formula, and the bag beside you fills with it, bottle by bottle, at the doses written on the page.
6. **Distance from premium-minimal.** The client's: clean, editorial and clinical.
7. **One world or scenes.** One reading column with a companion object. No pinned acts and no scenes: the home page has the big build scene, and this page must not repeat it (AGENTS.md: two pages never feel like one page shown twice).
8. **Assets.** All exist:
   - the clean bag plate and its mask
   - the blank ampoule and the two blank vials
   - the vial cap mask
   - our HTML labels (`home-v3/tools/blank-*.mjs`)

   No generation.

## The user's decisions (2026-11-02)

- **Motion:** "Client's bag + our bottles (Recommended)".
- **Photo:** "No photo on this page (Recommended)". The bag is the picture; the drip photos stay on the Drips cards and menu.
- **Scope:** no new pages from the client's artifact unless the client asks.

## Defaults (stated to the user, not asked)

- **Every dose is published.** That is our stance; the client hid doses.
- **No reviews, rating or comparison table.** These are placeholders (memory note: they are not real).
- **No fixed "6 sessions, one a week".** That is not ours: plans are per patient. The physician decides.
- **No "free consultation" offer** (not confirmed). Our real line: "No card needed to get a protocol reviewed".
- **"Tests you'll need first" says what we run:**
  - for everyone, the quiz read by a physician and baseline vitals at every session
  - for this drip, its own notes (labs, G6PD screening) from the Drip document
- **The health quiz is the action,** carrying this drip.
- **No per-ingredient "why".** No such data exists, and we write no medical claims. Each row shows name, dose, its vitamin (from the master), and where it goes: in the bag, or given separately with its note. The drip's own benefits (written in the Drip builder) keep their section.

## Treatment

The AGENTS.md table lists `/drips/[slug]` as Full. With the user's choice, the page has no engine-pinned act: its one peak is the companion bag, and the rest is a reading column (closer to Light). The table is updated at port.

## Journey and feeling curve

| # | Beat | Feeling | What causes it |
|---|---|---|---|
| 1 | The drip | "This is mine, and I can see what it costs" | Name, who it is for, price, the quiz. The bag beside it stands empty, its label naming the drip |
| 2 | What's inside | Curiosity turning into trust | Each row lights as it is read. Its bottle drops into the bag, the liquid rises, the count climbs |
| 3 | **Peak: the bag is complete** | "I watched my drip fill as I read what's in it" | The last row read: the level settles full and the label has printed every dose; anything given separately stands beside the bag |
| 4 | What it's for | Understanding | The drip's own benefits, plainly |
| 5 | Before your drip | Reassurance | What is checked, for everyone and for this drip |
| 6 | The session | It is practical | Four cards: cannula, time, what is given separately, the report |
| 7 | Price | Clarity | The price per session, the late-change rule; the physician sets how many sessions |
| 8 | Questions | Doubts resolved | The common questions; other drips in the same group |
| 9 | Ready to book? | Commitment | The booking slip with this drip, and the quiz |

**The peak**, in a visitor's words: "As I read down the list, each bottle dropped into the bag beside it, and by the end the bag was full and labelled with every dose." It lives in beat 3, the end of the list.

**Tell-someone sentence:** "It's the site where the drip fills up beside you as you read what's in it."

**Authored silence:** none. The column reads straight through; the bag only moves while the list is read.

## Grammar and devices

- **Grammar:** an editorial reading column with a sticky companion object. It differs from the home page, which is a question ledger with pinned acts.
- **Devices:**
  - sticky companion with a reading-driven fill (beats 1-3)
  - card grid (beats 4 and 6)
  - two-column checklist (beat 5)
  - figure pair (beat 7)
  - details list (beat 8)
  - booking slip (beat 9)
- **Signature move:** the reading fill with real bottles, page-local JS. The engine is unchanged; it is used only for entry reveals (`data-sc-in`).
- **Fingerprint:** one site (AGENTS.md); not gated against the `nutridrip-site` row. Varied from the home page in grammar, devices and peak.
