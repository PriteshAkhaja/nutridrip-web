# Old vs new — gap analysis

**Date:** 16 September 2026
**Question asked:** *"Old has all details need in new"* — what does the old build do that
the new one does not?


## What was compared

| | Old | New |
|---|---|---|
| Pages | 38 | 62 |
| API routes | 38 | 50 |
| Data models | 25 (Prisma) | 21 (Mongoose) |
| Components | 12 | 31 |

Plus all four client documents in `_reference/requirements/`: the PRD, `workflows.md`,
`user-flows.md`, `user-accounts-api-flows.md`, and the inventory design note.

## The short version

New is ahead of old almost everywhere. It has whole subsystems old never had — FEFO
inventory with batch lots, a recall trail, the 29-step checklist, availability
forecasting, adverse-event reporting, prescription OTP override, GST invoicing, and
treatment-plan sharing with the nurse and patient.

**Nine things genuinely go the other way.** Two of them are cases where the product
already promises something it does not do, which is why they rank above the rest.

---

## 1 · Consent cannot be reconstructed — despite the code saying it can

**Severity: high. Clinical record.**

The consent screen tells the nurse, in its own words:

> "Consent is recorded against a version, so what they agreed to can always be
> reconstructed."

It cannot be. Three separate reasons:

1. `CONSENT_VERSION = "v2.1"` is a string literal in
   `src/app/nurse/session/[id]/consent/ConsentCapture.tsx`. Nothing maps that version
   to any text.
2. The risks the patient agrees to are a hard-coded `RISKS` array in
   `src/app/nurse/session/[id]/consent/page.tsx`. Edit the wording and every past
   record claiming "v2.1" silently now refers to different text.
3. Worse — the drip's ingredients and doses shown on that screen are read **live** from
   the `Drip` record. A physician edits Myers' Revive next month and last month's
   consent record retroactively displays doses the patient never saw.

What is stored on the booking: `givenAt`, `signatureDataUrl`, `viaOtp`, `version`.

Old stored `consentText` — described in its own schema as *"the exact affirmation the
patient agreed to"* — plus `ipAddress`, `userAgent` and `signedByRole`.

This sits badly against the rest of this codebase, which is careful about exactly this
problem. The consumption ledger takes drug and batch identity from the master and the
lot *"so a row can never come out anonymous"*. Consent does not get the same treatment.

**Fix:** snapshot the affirmation text, the risk list and the dose list onto the booking
at the moment consent is captured, the way `Invoice` snapshots its lines.

---

## 2 · The audit log is written 31 times and read zero times

**Severity: high. The product promises this to users.**

```
AuditLog.create   written in 31 files
AuditLog.find     read in     0 files
```

`src/lib/auth/guard.ts` writes an `access.refused` row on every redirect, and **the
sign-in page and the privacy policy both tell the user this happens.**

Old had `/dashboard/admin/audit` (84 lines) and `/api/audit`. New has neither.

A trail nobody can read is not a trail.

**Fix:** one admin page and a read model. The data is all there and well shaped —
`actorId`, `actorRole`, `action`, `entity`, `entityId`, `before`, `after`, `at`.

---

## 3 · No password reset for staff

**Severity: high. Operational.**

| Old | New |
|---|---|
| `/forgot-password`, `/reset-password` | — |
| `/api/auth/forgot`, `/api/auth/reset` | — |
| `PasswordReset` model | — |

A doctor, nurse, admin or partner clinic who forgets their password must ask a super
admin to set a new one by hand.

Patients are unaffected — they sign in with a phone OTP.

---

## 4 · A session cannot be revoked

**Severity: medium. Security.**

Old kept a `UserSession` row per login — server-side and therefore revocable.

New issues a stateless JWT valid for `SESSION_EXPIRY_HOURS` (default 24). There is no
`jti`, no deny-list, no token version. A stolen token, or one held by a dismissed staff
member, **cannot be invalidated.** Setting the account to `inactive` does not help until
the token expires on its own.

**Fix:** a `tokenVersion` integer on `User`, included in the JWT and checked on read.
Bumping it invalidates every existing token for that account.

---

## 5 · The nurse's ETA is no longer shown to the patient

**Severity: low. Patient-facing.**

Old computed `etaMinutes` from the nurse's distance at assignment and showed the patient
**"12 min away"**. New shows only *"On the way"*.

New already has `distanceKm()` in `src/lib/clinical/nurse-options.ts`. The data exists;
the number is simply never computed or displayed.

---

## 6 · Smaller things old had

| | Old | Note |
|---|---|---|
| `/about` | 586 lines | no equivalent |
| `/faqs` | 578 lines | **content exists** — `FAQS` in `src/lib/data/marketing.ts`, used on the home and drip pages, but no dedicated page |
| `/how-it-works` | 580 lines | no equivalent |
| `/consult` | 906 lines | **half built** — `Lead` already accepts `kind: "consult"`, the API accepts it, but no form ever sends one |
| Per-physician Rx letterhead | `/api/rx-logo/[userId]` | new prints the NutriDrip mark for everyone |
| Clinic billing summary | `/dashboard/clinic/billing` (83 lines) | new invoices per order, but no monthly view |
| AI Studio | `/dashboard/admin/studio` | PRD §6.7, priority **P1**. Already listed as not built in `CLAUDE.md` |
| Custom cursor, scroll reveal | 2 components | deliberate design choices, not defects |

---

---

## 7 · Screen-level findings — statuses, buttons, CRUD

A separate pass over the screens rather than the routes: which buttons exist, which
statuses a table can actually display, and whether every state the model allows can be
reached by a human.

### 7a · "Nurse en route" can never happen

**Severity: medium. Patient-facing, and the UI is already built for it.**

The patient's home screen has a dedicated stage for it:

```js
if (status === "en_route") return "Nurse en route";
booking.status === "en_route" ? "On the way" : fmt(booking.scheduledAt)
```

`en_route` appears in three query filters — and **is never written anywhere.** The nurse
has no "I'm on my way" action, so that timeline stage can never light up. The patient
goes straight from *Nurse assigned* to *Consent & vitals*.

This is the same hole as gap 5: old had `SessionEvent` carrying both `status` and
`etaMinutes`, so the nurse set off, the patient saw "12 min away". New kept the display
and lost the trigger.

**Fix:** one button on the nurse's session screen, one `POST` that sets the status, and
the ETA from `distanceKm()`. Both gaps close together.

### 7b · A treatment plan can never be finished or removed

**Severity: medium. It accumulates.**

`PLAN_STATUS` allows `draft · awaiting_review · active · completed · archived`.
Only **two are ever reachable** — `draft` on create, `active` on share.

So:

- A four-week course whose last session ran in March still reads **Active** today.
- There is no delete, no archive, no complete. `/api/plans/[id]` has `PATCH` but **no
  `DELETE`**, and no screen ever sends a `status`.
- The physician's plan list grows forever and cannot be tidied.

Old's protocol builder had **Edit · Share · Preview · Delete**.

The `PATCH` route already accepts `status` in its Zod schema — nothing in the UI sends
it. Half the work is done.

### 7c · `draft` on a booking is dead

Minor. `BOOKING_STATUS` includes `draft`; bookings are always created as
`awaiting_review`. Nothing sets it, nothing displays it. Cleanup, not a defect.

### Checked and fine

| Screen | Verdict |
|---|---|
| **Patient detail** `/doctor/patients/[id]` | **Better than old** — 366 lines vs 120. New adds allergies, chronic conditions, surgeries, emergency contact, weight, height. Old had age, blood group, phone, vitality, last visit |
| Users | create, edit, and a status dropdown covering all four `USER_STATUS` values ✅ |
| Drips, Products, Kits, Quiz questions, Site copy | create + edit present (`DripEditor`, `MasterActions`, `KitEditor`, `QuizEditor`, `ContentEditor`) ✅ |
| Orders | create, plus confirm / dispatch / cancel — every `ORDER_STATUS` reachable ✅ |
| Leads | all five statuses reachable via `LeadStatus` ✅ |
| Quiz review | all four `reviewStatus` values reachable ✅ |
| Deletes that are absent **by design** | users, products, orders — `CLAUDE.md`: *"Never deleted, only retired"* ✅ |

## Checked and found NOT to be gaps

Recorded so nobody rebuilds them.

| Old | Where it lives in new |
|---|---|
| `CancellationLog` (fee, same-day) | **Fully implemented and better.** `LATE_CHANGE_HOURS = 4` and `LATE_CANCEL_FEE_INR = 500` in `src/lib/clinical/slots.ts`, enforced in the cancel route with an audit row, and reschedule is blocked inside the window. Old needed an approval queue; new just enforces it |
| `LoginAttempt` | **Better in new** — 5 attempts then a 15-minute lockout, on the `User` record |
| `Approval` | `HealthQuiz.reviewStatus` + `recommendedDripIds` + `recommendationStrength` |
| `InfusionOrder`, `NurseAssignment`, `SessionEvent` | `Booking` plus the read models in `src/lib/data/` |
| `QuizOption`, `QuizPart` | `QuizQuestion` |
| `Clinic` | `User` with `role: "clinic"` |
| `TxChart` | `TreatmentPlan` |
| `DripOrder` | `Order` |
| `ConsultRequest` | `Lead` (model only — see gap 6) |
| `/nurse/orders` | **Not preparation orders.** They are assigned *sessions* — patient, drip, schedule, checklist. Covered by `/nurse/schedule` and `/nurse/session/[id]` |
| `/patient/medical-history` | Merged into `/app/profile` (allergies, conditions, medication, surgeries, family history); the quiz asks smoking and alcohol |
| Testimonials | `TESTIMONIALS` in `src/lib/data/marketing.ts`, on the home and drip pages |
| PRD patient data model | Every field present |
| PRD admin "Revenue" | Present on `/admin`, with a monthly target |

---

## Where new is ahead — leave these alone

- FEFO inventory: `ProductMaster`, `BatchLot`, `Allocation`, `Consumption`, `StockTxn`
- Recall trace, expiry and low-stock alerts, pooled vs whole-vial availability
- The 29-step checklist, with vitals gating the infusion server-side
- Adverse-event reporting
- Prescription OTP override, with physician escalation and break-glass
- GST invoicing: tax invoice vs bill of supply, CGST/SGST vs IGST, HSN summary
- Treatment plans readable by the nurse and the patient
- Offline queue for the nurse app
- Three-layer permission model: `rbac.ts` → `guard.ts` → `ownership.ts`

---

---

## Every file in `_reference`, and what it told us

| File | Read | Verdict |
|---|---|---|
| `requirements/prd-nutridrip.md` | ✅ | §5.1 feature table walked. All P0 built. **AI Studio (P1) not built.** Analytics (P2) partly — admin overview has revenue against a target |
| `requirements/workflows.md` | ✅ | All six role sections plus the permissions matrix. Only gap: nurse §4.4 turned out to be *sessions*, already covered |
| `requirements/user-flows.md` | ✅ | 5 role sections, 20+ numbered flows. No gap not already listed |
| `requirements/user-accounts-api-flows.md` | ✅ | Per-role feature tables and data models. Every patient field present |
| `requirements/2026-08-07-inventory-management-design.md` | ✅ | Its own build checklist. Implemented |
| `requirements/inventory detials` | ✅ | Prose note on stock flow — master vs lot, FEFO, pooled vs whole-vial, reserve/consume/release, ledger, 90-day alerts. **Implemented exactly, point for point** |
| `mockups/…/Block 1 – Public site` | ✅ | Headline, "Nine drips", Myers' Revive, Pricing, "Questions people actually ask" — all present |
| `mockups/…/Block 2 – Patient app` | ✅ | "Enter the code", "Your vitality", "In progress", "Your history" — all present |
| `mockups/…/Block 3 – Doctor console` | ✅ | matches `/doctor` |
| `mockups/…/Block 4 – Nurse app` | ✅ | "My kit", day view — present |
| `mockups/…/Block 5 – Inventory` | ✅ | matches `/admin/inventory` |
| `mockups/…/Block 6 – Clinic and admin` | ✅ | matches `/clinic`, `/admin` |
| `mockups/…/Block 7 – States` | ✅ | four categories: loading, empty, failed, **offline**. All four exist (`States.tsx`, `DripLoader`, `offline/queue.ts`, `SyncStatus`) |
| `mockups/…/Block 8 – Responsive proofs` | ✅ | matches |
| `mockups/…/NutriDrip Design System` | ✅ | tokens in `globals.css` |
| `.html` / `.pdf` duplicates, 2 `.zip` archives | — | same content in other formats; nothing new |

New was built **from** these mockups, so they are the source of its design rather than a
source of gaps. The extracted copy matches the live site word for word.

---

## Suggested order

1. **Consent snapshot** (gap 1) — small change, closes a clinical-record hole the code
   itself claims is already closed.
2. **Audit viewer** (gap 2) — the data is there; it is a page and a read model.
3. **Password reset** (gap 3) — a real operational hole for staff.
4. **"On my way" + ETA** (gaps 5 and 7a) — one button and one route closes both. The
   patient screen is already built for it and `distanceKm()` already exists.
5. **Finish / archive a plan** (gap 7b) — the `PATCH` route already accepts `status`;
   only the UI is missing.
6. **Session revocation** (gap 4) — a `tokenVersion` on `User`.

Gap 6 is the client's call, not a defect.

A theme worth noticing across gaps 1, 2, 5 and 7a: in each case **the hard part is
already built and something small is missing at the end.** The audit rows are written,
the consent version field exists, the patient's "en route" stage is drawn, the distance
function is there. These are not features to design — they are wires to connect.

---

## A correction worth recording

On the first pass this document wrongly listed the cancellation fee as missing. That
came from a `grep` over `src/lib` and `src/app/api` that was flooded with unrelated
matches and cut off at six results. The fee is implemented, in `slots.ts` and the cancel
route.

The lesson: grep that returns noise is not evidence of absence. Every remaining claim
above was re-checked by reading the actual file.
