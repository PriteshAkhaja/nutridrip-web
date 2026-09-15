# NutriDrip

IV nutrient therapy platform — public site, patient app, doctor console, nurse app, inventory/pharmacy, and clinic & admin consoles. Built from the Block 0 design handoff and the client requirement docs in [`_reference/`](_reference/).

**Next.js 16 · React 19 · TypeScript · MongoDB (Mongoose) · Tailwind v4**

---

## Running it

```bash
cp .env.example .env.local     # defaults point at a local mongod
npm install
npm run seed                   # demo dataset: 9 drips, 25 products, 31 batches, 6 roles
npm run dev                    # http://localhost:3000
```

MongoDB must be a **replica set** — order confirm and dispatch run inside transactions. A standalone `mongod` will fail on those two routes and nothing else.

### Checking it still works

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # 76 unit tests over the pure logic
npm run smoke       # 131 end-to-end checks against a running dev server
```

`npm test` covers the parts where a wrong answer is a clinical problem: unit conversion refusing to cross families, the vital reference bands, the checklist sequence, quiz scoring, approval expiry, the permission matrix, zone coverage, and which batch a dose draws from. `npm run smoke` signs in as all six roles and walks the real paths — the order lifecycle down to the consumption ledger, the booking guards, the checklist gate, the vitals block and its physician clearance, tenant isolation between clinics, and every page render. It runs against the production build too, and reports which one it exercised.

The smoke test writes as it goes, so run it against a fresh `npm run seed` for full coverage. It cleans up the records it creates, and it is written to fail rather than pass vacuously — a check that cannot run reports itself as skipped.

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Super admin | `admin@nutridrip.com` | `admin123` |
| Admin | `ops@nutridrip.com` | `admin123` |
| Doctor | `dr.sarah@nutridrip.com` | `doctor123` |
| Nurse | `nurse.emma@nutridrip.com` | `nurse123` |
| Clinic | `clinic@healthfirst.com` | `clinic123` |
| Patient | `patient@example.com` | `patient123` |

Patients normally sign in by phone. Outside production the OTP is returned in the response and printed to the server log, since no SMS gateway is connected. The panel listing these accounts is hidden when `NODE_ENV=production`, so a live deployment never prints passwords on its sign-in page.

Phone numbers are normalised to E.164 before they are stored or looked up, so `9844471234`, `+91 98444 71234` and `09844471234` are one account rather than three.

---

## The two ideas the system is built around

**Stock does not divide evenly.** A vial opened for one patient cannot be pooled into the next, so the honest answer to "how many drips can we run today" is always lower than the arithmetic. Every availability figure is reported twice — pooled and whole-vial — and the gap between them is wastage. [`src/lib/inventory/availability.ts`](src/lib/inventory/availability.ts)

**A Fill always encodes a real quantity.** The design system's one primitive appears at five scales — a vitality ring, an IV bag draining, a 29-step checklist, a batch depleting — and never without its number beside it. [`src/components/ui/Fill.tsx`](src/components/ui/Fill.tsx)

---

## Layout

```
src/
├── app/
│   ├── (site)/          Public — home, catalogue, drip detail, pricing, safety,
│   │                    for-clinics, zones, legal
│   ├── login/           Phone OTP for patients, email/password for staff
│   ├── quiz/            16-marker health assessment
│   ├── app/             Patient — results, booking, live session, report, history, profile
│   ├── doctor/          Approvals queue, patient review, plans, Rx print, schedule, escalations
│   ├── nurse/           Route, 29-step checklist, vitals, consent, monitor, kit
│   ├── clinic/          Today, orders, order detail, bookings, profile
│   ├── admin/           Overview, approvals, people, enquiries, content, quiz builder,
│   │                    and the whole inventory module
│   └── api/             44 route handlers
├── components/
│   ├── ui/              Fill family, Button, Pill, Field, Table, Card, States, loader
│   ├── orders/          The order composer, shared by clinic and pharmacy
│   └── layout/          ConsoleShell (desktop rail), MobileShell (390px frame), sync status
└── lib/
    ├── models/          Mongoose schemas — 19 collections
    ├── inventory/       FEFO availability, reserve/dispatch, alerts, unit maths
    ├── clinical/        Checklist, vital ranges, quiz scoring, slots, batch snapshot
    ├── auth/            JWT sessions, RBAC matrix, route guards, phone, ownership
    ├── offline/         The nurse app's outbox
    ├── zones.ts         The 14 served pincodes, shared by the site and the booking guard
    ├── notify.ts        The cross-role notification spine
    └── data/            Read models for the screens
```

---

## How stock moves

A **product master** is the drug's identity — name, molecule, HSN, GST, category, canonical unit. Under it sit **batch lots**: the physical stock, each with its own brand, strength, batch number, expiry and quantity. "Vitamin C" is one master; VC-B7 expiring in 12 days and VC-B9 expiring in 184 are two lots of it.

Availability is never abstract. It is computed from concrete lots:

1. Pull every **in-date** lot (expired stock is silently excluded — never counted, never dispensed).
2. Subtract units already reserved by confirmed orders.
3. Divide usable stock by each ingredient's dose; the **lowest wins** and names the bottleneck.
4. Report both the pooled count and the whole-vial count. Single-use vials waste their remainder; multidose vials carry it forward.

An order runs through three states:

| State | What happens to stock |
|---|---|
| `DRAFT` | Nothing. A draft holds no stock. |
| `CONFIRMED` | Soft-reserves exact units. They stay on the shelf but stop counting as available, so two orders cannot promise the same vial. |
| `DISPATCHED` | Consumes whole units FEFO, decrements lots, releases the reservation, writes the immutable consumption ledger, and deducts the session kit per drip. |
| `CANCELLED` | Releases the reservation back to available. |

Every ledger row names its drug, its batch and the active content given, taken from the master and the lot themselves rather than from a recomputed plan — so a row can never come out anonymous. Where one dose spans two lots, both batches are recorded.

The consumption ledger is the recall trail. [Recall trace](src/app/admin/inventory/recall/page.tsx) answers "where did batch VC-B7 go" from it, and a partner clinic sees the batch numbers for its own dispatched orders on [its order detail](src/app/clinic/orders/[id]/page.tsx).

Alerts flag batches expiring within the horizon (90 days by default), expired stock still on the shelf, and any master at or below its reorder level.

---

## Clinical safeguards

These are enforced server-side, not just in the UI:

- **The checklist is a sequence.** A step cannot be ticked while an earlier mandatory one is open. All 29 steps must close before a session completes.
- **A session cannot be worked before it is approved,** and only by the nurse it was dispatched to. Every checklist, vitals, consent, observation and adverse-event route checks that ownership, and so does every nurse screen.
- **Out-of-range vitals block the infusion, and only a physician can lift it.** The nurse cannot override their own block. The physician either clears the session under their own name or stands it down, from [escalations](src/app/doctor/adverse/page.tsx). A fresh out-of-range reading clears the clearance — one look does not license the next.
- **Consent needs a signature or a verified code.** Neither one, and the request is refused.
- **A quiz is reviewed once.** A second decision on the same submission is rejected.
- **A patient sees only their own records.** Reports, results and lab files 404 for anyone else, and the physician's patient screen opens patient records only — not staff ones.
- **A refused access attempt is written to the audit log**, with who, what they wanted and their address. The sign-in page and the privacy policy both promise this, so it is enforced in the route guard rather than left as copy.
- **A partner clinic is a tenant.** It may only cancel, move or reassign sessions booked into its own rooms, and see only its own orders and bookings. Role alone is never the answer to "may I touch this record".
- **Phone sign-in is for patients only.** A six-digit code does not substitute for a prescribing credential, so a number on a doctor, nurse, clinic or admin record cannot open that session — staff sign in by email and password.
- **A plan belongs to the physician who signed it.** Another physician may read it; changing whose doses a nurse will draw is refused.
- **A session can only be worked once it has actually run.** An adverse event cannot be filed against a session that was cancelled or declined.
- **A booking must be backed by stock, a served pincode and an hour's notice.** The availability engine runs before a slot is confirmed; a pincode outside the 14 zones gets a straight no rather than a waitlist.
- **A step that opens a screen needs the record, not just the tick.** The baseline-vitals step will not close until a reading exists, because a session with no readings has nothing to be out of range — the safety gate would be disabled by skipping it. Consent and the closing vitals work the same way.
- **A slot can be moved three times, and not once the approval has lapsed.** Rescheduling is free outside the four-hour window and refused inside it, including after the slot time has passed.
- **The batch numbers are fixed when the nurse confirms the seals,** and recorded against the session — so a recall traces to the patient, not only to the order.
- **A recipe in use cannot be silently changed.** A drip with confirmed orders against it is locked until those dispatch or cancel — the reserved vials have to keep matching what will be prepared. A drip somebody has received is retired, never deleted. The same rule guards the session kit and a product's multidose flag.
- **A nurse cannot be stood down mid-session.** Deactivating a doctor or nurse who still holds live sessions is refused until those are reassigned.
- **Stock never goes negative, and reserved units are protected.** A write-off cannot take a batch below what confirmed orders already claim. Quarantined lots are excluded from every figure, so a drug whose only batch is quarantined never reads as healthy.
- **Every order transition is an atomic claim.** Confirm, dispatch and cancel each move the order with a conditional write inside the transaction, so two simultaneous confirms cannot both reserve, and a repeated cancel cannot credit the same units twice.
- **References never collide.** Booking and order numbers derive from the highest in use, not a document count, and retry on the unique index — so deleting a record or two simultaneous writes cannot reuse a number.

Reference ranges and the full 29 steps live in [`src/lib/clinical/checklist.ts`](src/lib/clinical/checklist.ts).

### Working offline

A nurse's phone loses signal in stairwells and basement flats. Every write the nurse app makes — a ticked step, a vitals reading, consent, an observation, an adverse event — goes through an outbox in [`src/lib/offline/queue.ts`](src/lib/offline/queue.ts). If the request cannot leave the device it is kept, **in order**, and replayed when the connection returns; a new request never overtakes an older one, which is what keeps the checklist a sequence. A step ticked *while* a replay is in flight joins the back of the queue rather than being overwritten by it. The banner at the top of the nurse app says what is waiting and what synced, and reports anything the server refused rather than dropping it silently.

---

## How the roles reach each other

Nothing in this system is a dead end. Every state change that somebody else needs to act on writes a notification, and the bell in both shells is the one surface that surfaces them.

| When this happens | Who hears about it |
|---|---|
| A patient submits the quiz | Every physician and admin, with the vitality score and any screening flags |
| A patient holds a slot | The physicians, so a booking never sits unreviewed |
| A patient books into a partner clinic | That clinic |
| A physician approves | The patient, **and** the nearest nurse under capacity, who is assigned automatically |
| A physician declines | The patient, with the reason |
| Baseline vitals fall out of range | The reviewing physician — the infusion is already blocked |
| A physician clears or stops a blocked session | The nurse and the patient |
| A nurse files an adverse event | The reviewing physician; severe ones also reach the admins |
| A session closes all 29 steps | The patient (their report) and the physician |
| A session is moved or cancelled | The nurse whose route it was on |
| An order is confirmed, dispatched or cancelled | The clinic that raised it |
| A short-dated batch is received | The admin team |
| A clinic enquiry arrives | The admin team |

**Nurse dispatch** is not manual. On approval, [`pickNurse()`](src/lib/clinical/assign.ts) ranks active nurses by great-circle distance from the patient, drops anyone at capacity (6 open sessions), and takes the nearest. If a specific nurse was requested but cannot take it, the fallback is applied *and reported* — never swapped silently.

---

## Design tokens

Transcribed into [`src/app/globals.css`](src/app/globals.css).

| | |
|---|---|
| Paper / surface / line | `#FFFFFF` `#F5F7F9` `#E3E7EB` |
| Ink | `#0A0C0E` `#434A50` `#6B7178` |
| Primary — the old site's cyan-teal | `#0A7FA1` (actions, the Fill) |
| Primary on dark | `#7EE3F8` (the accent fails AA on ink, so dark sections use a lifted tint) |
| Muted text on dark | `#949A9F` (the light-ground grey manages only 3.98:1 on ink) |
| Loader — light blue | `#2E90DC` fluid, `#E9F4FD` headspace, `#1B74B8` counter |
| Accent — apricot | `#E08A4C` (vitality ring only) |
| Safe / caution / critical / info | `#2F8F5B` `#C07A22` `#C0453C` `#45699B` |

The accent is the cyan-teal the previous NutriDrip site was built on (`#0B9EC8` there). It is darkened to `#0A7FA1` here because the original clears only **3.12:1** against white — a button label on it would fail AA. The darkened hue reads as the same colour and clears **4.60:1**.

The page loader carries **its own** tokens rather than following `--color-primary`, and is a deliberately different blue (`#2E90DC`): it is the light blue the client asked for by name, so a later move of the brand cannot recolour it by accident, nor a change to the loader move the brand. The two blues sit next to each other on first paint — brand cyan-teal against loader blue — which is a choice, not an oversight.

The brand and the `info` status hue are both cool, but far apart: `info` is a desaturated slate (`#45699B`), the brand a saturated cyan-teal (`#0A7FA1`). Keep the rule that a status hue never decorates and every status is paired with a word, and they do not collide.

Every one of those pairings was checked against WCAG rather than eyeballed, and several failed. The status hues are tuned to read as a status at a glance, which leaves them short of 4.5:1 for 11.5px type — `safe` managed 3.61:1 on its own pale ground and `caution` 3.10:1. Rather than change colours the design system chose, each status gained a darker **text** tint used only for words; the hue itself still draws every dot, border and bar, where 3:1 is the bar and it passes. The loader's fluid clears 3:1 against both white and the bag's headspace, so the fill line reads as a graphic, and its counter clears 4.5:1 as text.

| Status | Dot, border, bar | Small text |
|---|---|---|
| Safe | `#2F8F5B` | `#1B6039` |
| Caution | `#C07A22` | `#7D4E12` |
| Critical | `#C0453C` | `#8A2E28` |
| Info | `#45699B` | `#2F4A70` |

Instrument Sans sets headings, Inter carries prose, IBM Plex Mono carries every dose, vital, batch number, quantity, date and rupee figure — tabular, right-aligned in tables.

Two rules worth keeping: clinical hues are reserved for genuine status and never for decoration, and every colour is paired with a word — `SpO₂ 91%` reads as critical because it says *below safe range*, not because it is red.

---

## Administration — where everything comes from

Nothing in this system appears by magic. Each thing has exactly one place it is created, and one role that may do it.

| Thing | Created by | Where |
|---|---|---|
| Staff accounts (doctor, nurse, clinic, admin) | Super admin only | `/admin/users` → Add a person |
| Patient accounts | The patient, by phone | `/login` |
| Products (a drug's identity) | Super admin | `/admin/inventory` → Define a product |
| Product reorder level, storage, multidose | Super admin | `/admin/inventory` → Edit |
| Batches (physical stock) | Super admin | `/admin/inventory` → Receive a batch |
| Drip recipes | Super admin | `/admin/inventory/drips` → Create a drip |
| The session kit | Super admin | `/admin/inventory/drips` → Edit the kit |
| The health quiz | Super admin or admin | `/admin/quiz` — live, no deploy |
| Public site copy | Super admin or admin | `/admin/content` — live, reverts to defaults |
| Preparation orders | Clinic, or the pharmacy on their behalf | `/clinic/orders`, `/admin/inventory/orders` |
| Treatment plans and their Rx slips | Doctor | `/doctor/plans` → Write a plan → Print Rx |
| A patient's own details | The patient | `/app/profile` |
| Enquiry stage | Super admin or admin | `/admin/leads` |
| Nurse assignment | **Nobody** — automatic on approval | Override at `/doctor/schedule` |

A doctor login is a prescribing credential, so creating one stays with the super admin; an ordinary admin runs operations but cannot mint accounts or receive stock. `/admin/approvals` is the operations view of the physicians' review queue — it watches the 6-hour SLA but makes no clinical decision, because that stays in the physician console.

---

## What the review changed

The whole change set was reviewed across eight dimensions — clinical guards, stock maths, React and Next.js correctness, the new routes, data integrity, consistency, design, and a deliberate attempt to abuse it — and every finding was then argued against before it was accepted. Eighty-three were raised and thirty-four survived that. The ones worth knowing about:

- **Phone sign-in issued a session for any role.** Five staff accounts carry phone numbers, so anyone who knew the super admin's could have signed in without a password. Phone sign-in is now patients only.
- **Any clinic could cancel, move or reassign any booking on the platform** — the check was role membership, never "is this yours". A clinic is now scoped to its own rooms.
- **The baseline-vitals gate could be skipped.** The step could be ticked with no reading on file, and a session with no readings has nothing to be out of range, so the block never fired. The step now needs the record, an empty reading is refused, and the gate starts at cannulation rather than at the infusion.
- **The consumption ledger could come out anonymous.** At dispatch the plan was recomputed against post-reservation stock, so a lot whose whole remainder the order held dropped out and its ledger row lost the drug name. The row now takes its identity from the master and the lot.
- **Two simultaneous confirms could both reserve.** Every order transition is now an atomic claim inside its transaction.
- **The offline outbox could lose a write.** A step ticked while a replay was in flight was overwritten by the pre-flight copy of the queue.
- **Any physician could rewrite any other's treatment plan**, and an ordinary admin could issue the physician approval they were meant only to be waiting on.
- **The escalations badge hid the worst adverse events**, because stopping an infusion completes the session and the badge filtered on status. An event is now open until a physician records a determination — which the screen promised but had no way to do.

Two findings were argued down rather than fixed. The loader's counter pads with U+2007 FIGURE SPACE, which is digit-width and does not collapse, so the alignment was already correct. And the intro loader does paint over content for a moment: that is the cost of never putting a loader in the server-rendered HTML, which is what keeps the page visible to a crawler and to anyone without JavaScript.

---

## Not built yet

- **Payments** — bookings carry an amount, a payment status and a late-cancellation fee, but no gateway is connected.
- **Email and SMS** — notifications reach the in-app bell only. No OTP gateway, so patient codes are logged server-side and echoed in development.
- **Object storage** — lab reports upload and read back, but the file lives in the record rather than in a bucket, so uploads are capped at 4 MB.
- **AI Studio** — specified in the PRD, not started.

---

## Adding photography

Image slots render a striped placeholder until the real file exists, checked on the server so there is no broken-image flash and no layout shift when it lands. Drop a file at the path the slot names — the home hero wants `public/images/home-hero.png` — and it appears on next request.
