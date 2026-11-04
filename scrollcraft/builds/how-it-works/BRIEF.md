# How it works: brief (2026-11-03)

Self-authored under explicit creative delegation: the user said the remaining
pages need no approval ("you can build without asking me"). Built straight in
the route, not prototyped here; this file records the decisions.

- **Treatment:** Full (AGENTS.md). One pinned act, the peak.
- **No client page.** The client's tokens, type, buttons, slip and footer;
  the act is this page's own.
- **Grammar:** a relay. The home page already has a pinned list that lights
  step by step (its six steps) and a day timeline; IV vs Tablets has a dose
  travelling down two paths. So here nothing travels down a list: one card,
  your booking, moves sideways between three desks (Physician, You, Nurse).
- **Journey:** what happens and who does it (head) → the relay (peak) → when a
  step says no (the stops) → the checklist's phases → Ready to book?
- **Feeling curve:** head, oriented ("seven steps, a person at each") → relay,
  confidence building as each step stamps its row → stops, reassurance
  (nothing goes ahead on a no, and the money follows) → phases, quiet proof →
  slip, the action.
- **The peak:** "your booking slides from the doctor's desk to yours to the
  nurse's, collecting a stamp at each, and then turns over into your report."
- **Signature move:** the card's rows are fixed (the card never grows, as the
  user asked of the drip label): each step writes its row; after the last,
  the card flips to the report's contents.
- **Facts, all from the app:** the call before approval and the held slot
  (`lib/booking/create.ts`, `lib/data/calls.ts`); 90-day approval
  (`validity.ts`); the late-change rule (Billing); the checklist and its phases
  (`checklist.ts`); refund in full on a decline or a called-off session
  (`syncBookingMoney`); the code at the door (`consent-otp`, `rx-otp`).
- **Photos:** the first screen keeps its slot (`how-it-works.hero`, the
  admin can replace it); the six step and closing slots are retired.
- **Reduced motion:** a list of every step beside the finished card.
