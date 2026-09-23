# Gap fixes — progress and test cases

Working list for the gaps found in `OLD-VS-NEW-GAP-ANALYSIS.md`.
One at a time. Nothing is ticked until it has been run against a real database.

**Legend:** ⬜ not started · 🔨 in progress · ✅ done and tested · ⏸ blocked

---

## 1 · Consent snapshot ✅ DONE — all 10 tests pass against a live database

**Gap:** the consent screen says *"what they agreed to can always be reconstructed"* —
it cannot. The risk text is a hard-coded array, the version is a string literal, and the
doses are read live from the `Drip` record, so they change retroactively.

**Plan:** snapshot the affirmation text, risk list and dose list onto the booking at the
moment consent is captured, the way `Invoice` snapshots its lines.

### Test cases

| # | Test | Result |
|---|---|---|
| 1.1 | Capture consent by signature → the exact risk text is stored on the booking | ✅ signature on ND-4421 → snapshot stored |
| 1.2 | Capture consent by OTP → same text stored | ✅ stored: v2.1, 4 risks, 4 components |
| 1.3 | The doses stored match what was on screen at the time | ✅ doses match the recipe at capture |
| 1.4 | **Change the drip's recipe afterwards → the consent record does NOT change** | ✅ **recipe changed to 99999 mg → record still 5000 mg** |
| 1.5 | **Change the risk wording afterwards → past records keep the old wording** | ✅ guard test proven by editing v2.1 on purpose |
| 1.6 | A record captured before this change still renders (no crash on missing fields) | ✅ ND-4417 is a legacy record; page warns instead of implying |
| 1.7 | The session report shows what was actually consented to | ✅ report shows the agreement and the doses; legacy record says only the version is known |
| 1.8 | Consent cannot be captured twice for one booking | ✅ second capture → 409 |
| 1.9 | A nurse who does not own the session cannot capture consent | ✅ Sunita on Emma's ND-4419 → 404; her own ND-4421 → 200 |
| 1.10 | Neither a signature nor a code = refused | ✅ refused: "needs either a signature or a verified code" |

---

## 2 · "On my way" + ETA ✅ DONE — all 8 tests pass against a live database

**Gap:** `en_route` is never written, though the patient screen is built for it. The
nurse has no way to say they have set off, and the ETA old showed is gone.

### Test cases

| # | Test | Result |
|---|---|---|
| 2.1 | Nurse presses "On my way" → booking status becomes `en_route` | ✅ Emma → `{status:"en_route", etaMinutes:6}` |
| 2.2 | Patient's screen shows **Nurse en route** and the minutes | ✅ "Nurse on the way · Set off 16 Sept, 12:31 pm · about 6 min away" |
| 2.3 | ETA is computed from the real distance, not invented | ✅ 6 min from real coords, Koramangala → Ejipura |
| 2.4 | No nurse coordinates → the stage still shows, without a number | ✅ no coords → null → "on the way", stage still shows |
| 2.5 | Only the assigned nurse can press it | ✅ Sunita → "This session is not on your route" |
| 2.6 | Cannot be pressed on a completed or cancelled session | ✅ completed / cancelled / in_progress all refused |
| 2.7 | Starting the session moves it past `en_route` cleanly | ✅ checklist lists `en_route` as workable and sets `in_progress` |
| 2.8 | The patient gets a notification | ✅ "Your nurse is on the way · Jetlag Reset · about 6 min away" |

---

## 3 · Session revocation ✅ DONE — all 5 tests pass against a live database

**Gap:** stateless JWTs cannot be invalidated. A dismissed staff member keeps access
until the token expires.

**Note on timing:** revocation takes effect on the revoked user's *next request*, not
instantly — there is no push channel to a browser already sitting on a page. They are
signed out the moment they navigate or reload. That is inherent to stateless sessions
and is the expected behaviour, not a shortfall.

### Test cases

| # | Test | Result |
|---|---|---|
| 3.1 | Set a user to `inactive` → their existing session stops working | ✅ set inactive → existing session 307s, /api/me Unauthorized |
| 3.2 | Change a password → other sessions stop working | ✅ password changed → signed out on the next navigation or reload |
| 3.3 | The user's own new session still works | ✅ a fresh sign-in works again |
| 3.4 | Other users are unaffected | ✅ Emma unaffected throughout |
| 3.5 | Tokens issued before the change are rejected, not crashed on | ✅ a pre-upgrade token with no `v` is treated as v0 — nobody thrown out by the upgrade |

---

## 4 · Audit viewer ✅ DONE — all 7 tests pass against a live database

**Gap:** `AuditLog` was written in 31 files and read in none, though the sign-in page and
privacy policy promise the user it exists.

### Test cases

| # | Test | Result |
|---|---|---|
| 4.1 | The page lists rows newest first | ✅ newest first, 1,188 rows over 26 pages |
| 4.2 | Filter by action, by actor, by entity | ✅ 5 group chips + Action and Who selects, all DB-side |
| 4.3 | `before` / `after` are readable, not raw JSON dumps | ✅ `gstEnabled no → yes` — only fields that moved |
| 4.4 | An `access.refused` row appears after a real refusal | ✅ my own access test wrote them: `Riya Mehta · patient · permission:audit.view` |
| 4.5 | Only admin and super admin can open it | ✅ superadmin 200 · nurse 307 · patient 307 |
| 4.6 | Paging works on a large table | ✅ Page 1 of 26, Newer / Older |
| 4.7 | Nothing sensitive leaks — no password hashes, no tokens | ✅ fields matching pass/hash/token/otp/key render as "hidden" |

### Follow-up: the trail itself ✅

The viewer was only half the requirement. The PRD files audit logging under **§11.4
Compliance**, beside GDPR and medical data protection, and 18 mutating routes wrote no
row at all. The client chose to close all of it.

**Added:**

| Action | Why |
|---|---|
| `auth.signed_in` (password and OTP) | the trail could say who was refused but not who was here |
| `record.opened` | **the privacy policy promise** — see below |
| `lab.delete` | with file name, category, upload date and whether a physician had it |
| `order.confirm` · `order.dispatch` · `order.cancel` | the stock ledger records the movement; this records the decision |
| `booking.create` · `vitals.recorded` · `quiz.submitted` | clinical events that had no row |

**The promise, now kept.** The privacy policy tells patients *"every access attempt
against a clinical record is written to an audit log"*. Only refusals were. Reads are now
logged at all eight places a record can be opened — chart, assessment review, session,
both plan screens, own results, prescription print, and the lab-report **file download**.

Three decisions inside that:

- Written **after** the ownership check, so a refusal is never filed as a read.
- `own: true/false` distinguishes a patient reading their own record from staff reading it.
- **No deduplication.** Opening the same chart twice writes two rows, because that is
  what happened. A "once per hour" rule would quietly reopen the gap this closes. Volume
  is bounded by *scope* instead: only a patient's clinical record. Dashboards, lists and
  settings screens are not somebody's medical record and are not logged.

**Deliberately still not logged:** failed sign-ins (the lockout counter already bounds
them, and logging every wrong password would let anyone flood the trail from the sign-in
page without an account) · `/availability` and `/geocode` (calculations) ·
`/notifications` PATCH (marking read) · `/bookings/[id]/observe` (high-volume telemetry) ·
`/leads` POST (public form — updates *are* logged) · `/auth/logout`.

### Detail view

Each row opens at `/admin/audit/<id>`: the full before/after with nothing truncated, the
actor with a link to everything they have done, and a link to the record itself.

`record.opened` is deliberately **not** marked notable — with eight log points and no
deduplication it will be among the highest-volume actions in real use, and tinting it
would bury the refusals and break-glass rows that flag exists for.

## 5 · Finish / archive a plan ✅ DONE — all 7 tests pass against a live database

**Gap:** only `draft` and `active` are reachable of five statuses. A finished course
reads *Active* forever and cannot be removed.

### Test cases

| # | Test | Result |
|---|---|---|
| 5.1 | Mark a plan completed → it shows as Completed | ✅ active → completed |
| 5.2 | Archive a plan → it leaves the default list | ✅ archived → leaves the Open list; an Archived tab holds it |
| 5.3 | Delete a **draft** plan → gone | ✅ draft deleted, with the patient, diagnosis and session count kept on the audit row |
| 5.4 | A shared plan cannot be deleted, only archived | ✅ shared plan → "Archive it instead — it comes off every screen and the record stands" |
| 5.5 | Another physician cannot change someone else's plan | ✅ Dr Amit on Dr Sarah's plan → "Another physician wrote this plan" |
| 5.6 | Archiving a shared plan tells the nurse | ✅ nurse: "no longer on your schedule" · patient: "your physician has archived it" |
| 5.7 | An archived plan drops off the nurse's and patient's screens | ✅ gone from both the nurse schedule and the patient home |

---

### Polish, after your review ✅ DONE — all 7 checks pass against the running app

| # | What you asked | Where to see it | Result |
|---|---|---|---|
| 5.8 | Action dropdown in alphabetical order | Admin → Audit trail → **Action** | ✅ Access refused · Adverse closed · Adverse reported · Auth signed in … (count stays on each line) |
| 5.9 | Who dropdown in alphabetical order too | Admin → Audit trail → **Who** | ✅ sorted by name; the list is still *cut* at the 40 busiest, only *ordered* by name |
| 5.10 | Mark complete asks first | Doctor → Plans → **Mark complete** | ✅ "Mark Riya Mehta's course complete? … You can reopen it if more sessions are needed." → **Mark it complete** / Cancel |
| 5.11 | Buttons styled by what they do | Doctor → Plans | ✅ Mark complete and Archive are `secondary`, Delete is `destructive` (red text, plain border), the confirm is `danger` (solid red). Delete only appears on an unshared **draft** — there is none in the database right now, so create one to see it |
| 5.12 | A name, not an id, in the trail | Audit trail → **On** column | ✅ reads "User / Platform Owner" instead of "User / …d937e". Falls back to the id only when the account has been removed |
| 5.13 | A name on the detail page too | Open any row about a person | ✅ Record: User · **Name: Platform Owner** · Record id: 6aa923… — the id stays, because that is what the trail is keyed on |
| 5.14 | Dropdowns stop resizing when you change group | Click Everything → Access → Clinical | ✅ Action stays 280px and Who stays 240px on every group (was 300px → 206px). Both go full width on a phone |

**Why the widths moved:** the select was sizing itself to its widest option, because the
shared control's `w-full` was winning over the width the page asked for. The width now
sits on a wrapper, so the control fills a box the page controls.

**5.15 · Names for every record, not just people** ✅

| Record | Shown as | Where it comes from |
|---|---|---|
| Booking | `ND-4421` | `bookingNo`, already on the record |
| Order | `PO-2026-0112` | `orderNo`, already on the record |
| Treatment plan | `Riya Mehta's plan` | plans carry **no** reference of their own, so they are named by the patient they were written for |
| Drip | `Myers' Revive` | `name` |
| Product master | `Magnesium sulphate` | `name` |
| Batch lot | `Batch VC-B9` | `batchNo` |
| Health quiz | `Anita's quiz` | `name` |
| Route | `permission:audit.view` | not a record — shown in full, never shortened |

The kind of record is written out too: `TreatmentPlan` now reads **Treatment plan**,
`ProductMaster` reads **Product master**. That is derived from the capitals, so a model
added next year reads correctly without anyone updating a list.

A deleted record still falls back to `…45db96` — the row stands even when the thing it
was about is gone, which is the whole point of a trail.

**Cost:** one query per *kind* of record on the page, never one per row — at most seven
indexed lookups for a fifty-row page, and none at all on a page of refused-access rows.
Measured at 0.58–0.70s for the full page, unchanged from before.

**5.16 · Date range filter** ✅ — 7 unit tests + checked against 1,331 live rows

The first question anyone asks a trail is "what happened on 12 March", and there was no
way to ask it. Now: **From** and **To** date fields plus four quick ranges — Today,
Last 7 days, Last 30 days, This month.

| # | Test | Result |
|---|---|---|
| 5.16.1 | One day returns only that day | ✅ 16 Sept → 154 rows, all 16 Sept |
| 5.16.2 | **Midnight boundary** — no row lost or counted twice | ✅ 154 (16th) + 1,028 (15th) = 1,182, exactly the 15–16 range |
| 5.16.3 | One end on its own | ✅ "from 16 Sept onwards" 154 · "up to 15 Sept" 1,177 — and 1,177 + 154 = 1,331, the whole trail |
| 5.16.4 | A backwards range is read as the one that was meant | ✅ 16→15 returns the same 1,182 as 15→16, rather than nothing |
| 5.16.5 | A mistyped date shows everything, not an empty page | ✅ `?from=nonsense` → all 1,331. `2026-02-31` rejected, not moved to 3 March |
| 5.16.6 | The counts follow the window | ✅ on 16 Sept the group chips read 133+17+0+4+0 = 154, matching the total exactly; "Access refused" shows (110) not (1,048) |
| 5.16.7 | An empty window says *why* it is empty | ✅ "Nothing in that date range — no action was recorded between 01 Jan 2027 and 02 Jan 2027" |

The heading names the window too: *"154 entries on 16 Sept 2026"*.

**The timezone decision, because it will matter later.** Dates are handled in the
**server's own timezone**, on purpose. Rows are displayed with `toLocaleDateString` and no
`timeZone` option, which is also server-local — so a row that *displays* as 16 Sept is
exactly a row the 16 Sept filter returns. Those two must move together. If the app is
ever pinned to IST for display, this filter has to be pinned with it, or rows near
midnight will quietly disagree with the filter that found them. It is written down in the
code beside the function.

Also handled: changing any filter drops the page number (staying on page 14 of a
two-page result would show an empty table), and paging carries the dates with it.

**5.17 · CSV export** ✅ — 11 unit tests + checked against the live trail

**Download CSV** sits at the end of the filter bar and exports **the filter, not the
page** — narrow to a window and a person, download exactly that. The label reads
"Download CSV (this filter)" whenever anything is narrowed, so a partial export is never
mistaken for a full one.

| # | Test | Result |
|---|---|---|
| 5.17.1 | The file matches the filtered page | ✅ Clinical: 163 on screen, 163 rows in the file |
| 5.17.2 | Columns survive real data | ✅ 1,337 rows parsed with a strict CSV reader, **0** with a wrong column count, including 10 rows holding a comma inside a cell |
| 5.17.3 | Only admin and super admin may export | ✅ no session 401 · nurse 403 "Not allowed" |
| 5.17.4 | The export is itself audited | ✅ an `audit.export` row, written **before** any bytes are sent, recording the filter used and the row count |
| 5.17.5 | Excel opens it correctly | ✅ UTF-8 BOM, CRLF line endings, `attachment` filename carrying the date range |
| 5.17.6 | Formula injection is neutralised | ✅ unit-tested — `=`, `+`, `@` and tab are prefixed with `'`, and `-12` stays a number |
| 5.17.7 | It does not load the trail into memory | ✅ streamed from a cursor in batches of 500; 232 KB / 1,337 rows in 0.45s |

**Why the injection guard matters here.** Excel executes a cell starting with `=`, `+`, `@`
or a tab. The trail records values that came from forms, so anyone who can type into any
field in the app could choose what lands in a file an admin later opens. That is the one
place a read-only compliance export could turn into code execution. Leading formula
characters are prefixed with `'`, which Excel will not evaluate and which stays visible.
Honest limit: this is proven by unit test, not end to end — no row in the database
currently starts with a formula character.

**The file contains its own download.** The export row is written before the read, so a
file exported with no filter holds one row more than the count logged with it. That is
deliberate: an auditor downloading the trail should see the download in it.

### Found while testing the export: billing changes were not being recorded

Planting a value through the billing route to test the CSV turned up a real gap — the
`billing.update` audit row recorded only `gstEnabled` and `gstin`. Changing the
**registered address** or the **payment terms** wrote a row that said *nothing had
changed*. Both are printed on every legal tax invoice. All four fields are now recorded,
and the trail reads `terms: Payable within 30 days… -> …` as it should.




## 6 · Password reset ⏸ BLOCKED

**Blocked on the client**, not on code. Email and SMS are not built — OTP codes are
logged server-side and echoed outside production, so a reset link has nowhere to go.

Three options, and it is their decision:

1. **Phone OTP** — works today, reuses `OtpToken`. Only for staff with a phone on record
2. **Email link** — needs an email provider first; that is its own task, and it unblocks
   notifications too
3. **Admin-set temporary password** — what happens today, just formalised

**Ask before building.**

---

## Not in this list — the client's call

`/about` · `/faqs` · `/how-it-works` · consult form · per-physician Rx letterhead ·
clinic monthly billing · AI Studio.

Not defects. Put the list to them rather than guessing.

---

## Retention of records ⏸ DECIDED: no deletion for now

**Decision (16 Sept 2026):** nothing is deleted. No deletion code is built yet.

**Why that is safe:** audit rows are 213 bytes each. At 100 sessions a day the audit
table grows by about 90 MB a year, so storage is not a reason to delete anything.

**Proposed policy, for the client to confirm:**

| Record | Keep for |
|---|---|
| Clinical records (`Booking`, `TreatmentPlan`, `LabReport`, `HealthQuiz`) | at least 10 years |
| Audit trail (`AuditLog`) | at least as long as the records it describes |
| Anything under a complaint, investigation or court case | until that is closed, even past 10 years |

India has no single retention period. The 3-year NMC rule is a minimum for one kind of
record, not permission to delete everything after 3 years. 10 years is the cautious
default.

**Before this is final:**

- Check **Karnataka's** Clinical Establishments rules. NutriDrip is in Bengaluru; the
  10-year rule found in research was Tamil Nadu's.
- The client's lawyer confirms the numbers above.

**When deletion is built later:** build the legal hold first, so a record under dispute
can never be deleted, and log every deletion in the audit trail.

**Separate open item:** `npm run seed` wipes every clinical collection and has no guard
against running on production. Not fixed yet.

---

## 7 · The pages and features that were missing 🔨 BUILT — 3 checks wait on a server restart

**Source:** the "Not in this list — the client's call" list above. Asked to build them, so
they are built. Checked against the whole `_reference` folder first: the PRD names only
**AI Studio** (§6.7, P1); the mockups have the FAQ inside the Pricing page and "How it
works" as a nav item, and nothing else; the requirement docs never mention `/about`,
`/faqs`, `/how-it-works`, the consult form, an Rx letterhead or clinic monthly billing
(only a monthly volume *target* on the clinic profile). Those come from the old build,
and its content was **not** copied — see "Found on the way".

Tests: 392 passing (was 269). Typecheck and lint clean.

### 7.1 · `/about`, `/faqs`, `/how-it-works`

| # | Test | Result |
|---|---|---|
| 7.1.1 | All three render and are reachable | ✅ 200 on each. "How it works" is in the header nav (the mockup has it there); About, FAQs and Ask a clinician are in a new footer column |
| 7.1.2 | No sideways scroll, and the header does not collide, at every width | ✅ 20 page-and-width combinations (390 · 768 · 1024 · 1180 · 1440), 0 problems |
| 7.1.3 | The numbers in the answers come from the rules that enforce them | ✅ 90-day approval, the 4-hour line, the ₹500 fee and the 14 zones are read from their constants, and a test fails if they drift |
| 7.1.4 | The FAQ does not promise what the app cannot do | ✅ tests refuse "refund", card and UPI, an export-or-delete button, HIPAA / ISO / GMP / CDSCO, and "nobody else can see your record" |
| 7.1.5 | Search finds words in any order and opens each match | ✅ "cancel fee" → "Showing 1 of 20 answers", the cancellation answer open |
| 7.1.6 | About carries no invented figures | ✅ four figures counted live: 9 formulas, 14 zones, 29 steps, 90 days |
| 7.1.7 | Tap targets are 44px on a phone | ✅ chips and link rows raised from 22–36px |
| 7.1.8 | Everything lines up with the header | ✅ headings at x=113 on every new page, as on Safety (the shared `Section` was 20px narrower a side; it now has an opt-in `wide`) |

### 7.2 · Ask a clinician (`/consult`)

Writes to the existing enquiries (`kind: "consult"`), so there is no new backend.

| # | Test | Result |
|---|---|---|
| 7.2.1 | A request with no way to reply is refused | ✅ 422 |
| 7.2.2 | Anyone can send one, signed in or not, and it reaches Enquiries as a consultation with its message and pincode | ✅ |
| 7.2.3 | The pincode answers as you type | ✅ 560095 "Koramangala — we serve it" · 110001 "We do not serve that pincode yet. You can still ask us a question." · a limited zone names its shorter hours |
| 7.2.4 | Ticked topics and best time are written into the message in a fixed shape; a value the form never offered is dropped | ✅ 20 tests |
| 7.2.5 | It never claims a booking | ✅ says "a request, not an appointment — nothing is booked and no payment is taken". The old build's "Consultation booked!" over a form that booked nothing is not carried over. What happens next is editable in Site copy |

### 7.3 · Per-physician Rx letterhead (`/doctor/letterhead`)

A physician's practice name, qualifications, address, contact and closing note head their
own prescriptions. **Registration number and council are not editable here and always
print** — they come from the record an administrator verified.

| # | Test | Result |
|---|---|---|
| 7.3.1 | Dr. Menon's slip is headed by her practice, with NutriDrip's establishment registration in a slim "issued through" line and her registration in the physician block | ✅ read from the live printed page |
| 7.3.2 | With no letterhead the slip is exactly as before | ✅ default header, no "issued through" line |
| 7.3.3 | A letterhead cannot change a credential | ✅ licence, council and specialisation unchanged through a save and a clear; a licence number sent in the body is stripped (tested) |
| 7.3.4 | Only a physician has one | ✅ nurse 403 · patient 403 · no session 401 · **super admin 403** (nobody edits it on a physician's behalf) |
| 7.3.5 | Errors read as words and land under the right field | ✅ "That does not look like a phone number" · "An address is at most 4 lines" |
| 7.3.6 | The save will not claim success it did not achieve | ✅ read back after writing. Against the stale server it answered 500 "could not be saved, and nothing was changed" — no audit row, no data change |
| 7.3.7 | The form's preview is the same component as the paper | ✅ one `LetterheadBlock` used by both |
| 7.3.8 | **Saving from the form, and seeing it on the slip** | ⏸ **needs the dev server restarted** — see below. 3 smoke checks: save · save again says "nothing changed" · slip is headed by it |

### 7.4 · Clinic monthly billing (`/clinic/billing`)

A month's invoices, with totals and a printable statement. It shows what has been
**invoiced** — there is no payment gateway and an invoice has no paid state — so nothing
on it says "due", "paid" or "outstanding", and the page and the sheet say so.

| # | Test | Result |
|---|---|---|
| 7.4.1 | Figures reconcile to the paisa | ✅ ₹23,214.29 taxable + ₹2,785.71 GST = ₹26,000.00, matching the invoice |
| 7.4.2 | **Another account never sees a clinic's invoices** | ✅ super admin's statement lists none of them · a nurse is redirected · every query is scoped by the session's clinic id, and there is no parameter that could name another |
| 7.4.3 | An order dispatched but not yet invoiced is named, not silently missing | ✅ shown as "1 order sent in September not yet invoiced" until its invoice was opened; then it moved into the figures |
| 7.4.4 | Month edges | ✅ 27 tests: half-open month, leap February, December → January, an invoice at midnight belongs to one month only |
| 7.4.5 | Money is added as whole paise | ✅ 0.1 + 0.2 = 0.3 exactly; 1,000 × ₹0.01 = ₹10 |
| 7.4.6 | A hand-edited month falls back to the current one | ✅ `?month=september`, `2026-13`, `1999-12` |
| 7.4.7 | Printable statement | ✅ header, billed-to with GSTIN, table, totals, and "not a record of payments and does not show a balance due" |

### 7.5 · AI Studio (`/admin/studio`) — super admin only

The PRD's model list with Create / Edit / Toggle Active–Test / Delete. **Nothing in the app
reads these settings** — recommendations come from the quiz's scoring rules and are reviewed
by a physician — and the first thing on the screen says so. No API key is ever stored.

| # | Test | Result |
|---|---|---|
| 7.5.1 | Super admin only, and hidden from an admin who could not use it | ✅ no session 403 · admin 403 (page redirects) · physician 403 · the nav link is absent for admin, present for super admin |
| 7.5.2 | A new model always starts in Test | ✅ even when the request said `status: "active"` |
| 7.5.3 | **Only one model is active — even when four are activated at once** | ✅ 3 rounds of 4 simultaneous requests: never more than one active; a real collision gets a plain 409. **This test found a real bug** — see below |
| 7.5.4 | Renaming does not overwrite the temperature or length | ✅ the zod `.partial()` keeps `.default()` trap, tested |
| 7.5.5 | A model needs a system prompt to be made active; the active one cannot be deleted | ✅ 409 with a plain reason |
| 7.5.6 | Every change is in the audit trail with before and after | ✅ `ai.create` · `ai.update` (only what moved) · `ai.activate` (names the model it replaced) · `ai.deactivate` · `ai.delete` (full row kept). Filed under Admin, in the label and the filter |
| 7.5.7 | The form uses one set of messages | ✅ the browser's own range check silently blocked a bad temperature and said nothing; now `noValidate`, and "Temperature is between 0 and 1" shows under the field |
| 7.5.8 | A duplicate name, in any case, is refused | ✅ |

**The bug 7.5.3 found:** after four simultaneous activations *three* models were active.
The guard — a partial unique index — had never been built: the schema also said
`index: true` on the same key, the two collided on the name, and Mongoose dropped the one
that mattered without a word. Fixed (one named index, `one_active_model`), built in the
live database, and re-tested. The page also now shows a red notice if it ever sees two.

### Found on the way — not changed, yours to decide

1. **Public copy over-promises.** The home and Pricing FAQs say *"you can export or delete
   your record from your profile"* (there is no such button) and *"you are not charged for a
   session that does not run"* (there are no payments). The home and Pricing FAQs also say
   *nobody but you, your physician and the nurse can see your record* — an admin can open
   lab reports and work the approvals queue. The privacy policy says *"ask from your
   profile and we will export everything"*. The new `/faqs` says none of these.
2. **The invoice rounds to whole rupees**; the new statement shows paise. A ₹23,214.29
   taxable value reads ₹23,214 on the invoice and ₹23,214.29 on the statement.
3. **`npm run seed` does not wipe `Invoice`**, so a reseed leaves orphans — INV-2026-0001
   belongs to a clinic that no longer exists. The statement correctly hides it.
4. **Claims not carried over from the old About page:** 12,400 clients, named
   leadership, and four certifications (HIPAA, ISO 9001, GMP, CDSCO). None can be backed
   up from this build. If the client has real people and real certificates, they belong
   in Site copy, not in code.
5. **A wording I invented and the client should confirm:** the About and consult intros
   are new copy. All of it is in **Site copy** (About page, Consultation request) so the
   business can change it without a developer.

### To finish

**Restart the dev server** (`Ctrl+C`, then `npm run dev`). The physician letterhead adds a
field to the `User` model, and a running Next dev server keeps the old compiled schema —
Mongoose then silently drops the new field. Nothing is wrong with the code; the save is
refusing, on purpose, to pretend. After the restart the 3 waiting checks (7.3.8) pass, and:

```
npm run seed      # gives Dr. Menon her letterhead and adds an AI Studio draft + a consult request
npm run smoke     # now includes a section for everything above
```

---

## AI Studio is switched off for now

**Decision (19 Sept 2026):** AI Studio (section 7.5) is switched **off**. Nothing was
deleted: the page, the API, the model, the seed draft and the tests are all still in the code.

**How it is off:** one setting, `AI_STUDIO_ENABLED` in `src/lib/ai/enabled.ts`, set to
`false`. While it is off, the sidebar link is gone, `/admin/studio` is a plain 404, and
`/api/admin/ai` answers 404 to everyone. The smoke test skips the AI checks and instead
checks that it really is off.

**To bring it back:** change that one line to `true`. Nothing else.

**What stays:** the AI rows already in the audit trail (the trail is never edited), and the
one draft in Test in the database.

---

## Statement amounts now match the invoice (whole rupees)

Item 2 under "Found on the way" (section 7) is fixed. The invoice prints whole rupees, so
the clinic billing page and the printed statement do too: ₹23,214.29 shows as ₹23,214 in
all three places.

| # | Test | Result |
|---|---|---|
| 7.4.8 | The same invoice reads the same on the invoice, the billing page and the statement | ✅ taxable ₹23,214 · GST ₹2,786 (the invoice's CGST ₹1,393 + SGST ₹1,393) · total ₹26,000. No paise on either page |
| 7.4.9 | The totals add up to the figures shown | ✅ totals are the sum of the rounded rows, so the footer always equals its own column. 33 statement tests, including three rows of ₹10.40 showing 10 + 10 + 10 = 30 |

This replaces the earlier 7.4.1 wording ("reconcile to the paisa"): the underlying invoice
still holds the exact paise, and only what is displayed is rounded.


## Pagination: every growing list is paged by the database

Before this, the lists either loaded everything or cut off silently (`.limit(200)`, `.limit(300)`), so the 201st enquiry or the 301st person could not be seen at all. Now a list asks MongoDB for one page and a count, and never fetches rows to throw them away.

### How it works

- **One shared piece of logic** (`src/lib/pagination.ts`, pure and unit-tested) and **one shared database helper** (`src/lib/pagination-db.ts`): count, skip and limit all happen in the query, together.
- **One shared footer** (`src/components/ui/Paged.tsx`): "Showing 26–50 of 137", Previous / numbered pages / Next, rows per page (10, 25, 50, 100), and a jump-to-page box on a big list. Page, rows-per-page and filters all live in the URL, so a page can be shared, refreshed, and the back button works.
- **Responsive**: stacked on a phone (44px touch targets, "Page 2 of 6" instead of a long strip), two rows on a tablet, one row on a wide screen. Measured with no sideways scroll at 390, 768, 1024 and 1440 px.
- **Theme**: the current page uses the primary colour, like the tabs and chips; nothing is hard-coded.
- **Safe with bad input**: `page=abc`, `page=0`, `pageSize=999999` all give a valid first page, capped at 100 rows. A page past the end shows the last real page.
- **No repeated or missing rows**: the sort always ends with `_id`, so two rows made in the same millisecond keep one fixed place.
- **Rows-per-page survives a filter change** (audit filters, inventory tabs and search, People, and so on).

### Where it is now

| Screen | Paged in the database |
|---|---|
| Audit trail | yes |
| People, Enquiries, Prep orders | yes |
| Inventory → Batches | yes (search and counts moved into the query as well) |
| Clinic orders, Clinic bookings | yes |
| Doctor patients, Doctor plans | yes |
| Doctor escalations | closed history paged; open reports always shown in full |
| Patient sessions | history paged; upcoming always shown in full |
| Patient lab reports | yes (only the fields a row shows are read) |
| APIs: users, leads, orders, bookings, plans, lab-reports | yes: `?page=&pageSize=`, reply carries a `pagination` block, existing keys unchanged |

### Left unpaged on purpose

A worklist must never hide an item on page 2. These stay whole: open escalations, upcoming sessions, the nurse's day route and kit list, the doctor's 14-day schedule, the approvals pending queue, dashboard "recent" widgets, and the small dropdown lists (active patients, drips, clinics). The escalations page used to cap at 100 in one query, which could have hidden an open report; it now loads every open report and pages only the closed history.

Note for later: the plan builder loads all active patients for its picker. That is fine today; a search-as-you-type picker would be a separate improvement.

### Speed

- Inventory totals per product are now one database aggregation, not every batch summed in code. Compared with the old code on the live data (lots, searches, counts, and paged rows stitched back together): identical.
- Indexes added for every paged sort (filter, then sort key, then `_id`) on User, Lead, Order, Booking, TreatmentPlan, LabReport, BatchLot and AuditLog, and built in the live database. `explain` shows every paged query using an index with no in-memory sort.
- First version of these indexes left out `_id`, and `explain` caught it (every query still sorted in memory). Fixed before finishing.
- On a throwaway collection of 200,000 bookings (50,000 belonging to one patient): a page took about 100–145 ms without the right index and about 15–38 ms with it, including the count, and page 2000 costs about the same as page 1.

### Tests

| # | Test | Result |
|---|---|---|
| P.1 | Unit tests for paging, page window, links and sort (`tests/pagination.test.ts`) | ✅ 37 pass; whole suite 439 pass; lint and typecheck clean |
| P.2 | Every list API reports its page, sends no more than the page size, page 2 differs from page 1, a page past the end is pulled back, nonsense input is safe and capped at 100 | ✅ 6 lists, 33 smoke checks pass (2 "page 2" checks skipped: those lists have two rows or fewer) |
| P.3 | Audit and Batches footers say which rows are shown; an audit page past the end still renders | ✅ |
| P.4 | Old vs new inventory code on live data | ✅ identical |
| P.5 | Pager in the browser at 390 / 768 / 1024 / 1440 px | ✅ no sideways scroll, controls 44px on touch and 36px on desktop |

Not passing in the last smoke run, and not caused by this work: the order confirm and dispatch checks need MongoDB as a replica set (this machine runs a standalone one), and the "vitals step" check needs a fresh `npm run seed`. The recall page failed once in that run and rendered normally straight afterwards and later in the same run.

## Pagination audit: every module checked

A second pass over all 70 pages, all list APIs and the data layer, looking for any list that loads everything, or that stops at a hidden limit (`.limit(20)`, `.limit(60)`) without saying so.

### Found and fixed

| Where | Problem | Fix |
|---|---|---|
| Nurse → Schedule → History | Silently stopped at 60. A nurse's 61st past session could not be seen. | History is now paged in the database. Upcoming stays whole, because it is the nurse's worklist. |
| Physician → Patient page | The whole session history was loaded into one table. | Sessions are paged. The "X completed of Y" and "N adverse events" figures are database counts, so they stay correct on every page. |
| Nurse → Schedule → Treatment plans | A hidden `.limit(20)` cut the list short, so the heading could count the wrong number. | Removed. The list shows every shared plan that is not archived. The patient dashboard, which shows only the current plan, now fetches just one. |
| Physician → Review a quiz → Lab reports | Only the latest 20 reports were shown, with no warning. An older ferritin result could be missed. | Every report is shown. The rows are small because the file itself is not read. |
| Nurse → Me → Ratings | Every rated session was loaded to show 5 comments. The `limit` setting never reached the query. | The average, count and "poor" figures are summed by the database, and only 5 comments are fetched. |
| Admin dashboard and Clinic profile → this month's revenue | Every session completed this month was loaded to add up one field. | Summed by the database. |

On the live data, all the new figures match the old ones: ratings for every nurse, overall revenue, and revenue for every clinic.

### Checked and left as they are, on purpose

| Where | Why |
|---|---|
| Approvals → reviewed in the last seven days | It shows the 20 most recent, and the heading says "showing 20 of N" with the real total. It is a recent-activity view. The pending queue above it is never cut short. |
| Admin dashboard: recent sessions (8), open orders (5) | Dashboard previews. Open orders links to the full, paged orders list. |
| Notification bell (20) | The unread count is a real total. The bell shows the latest. |
| Inventory alerts, recall trace, open escalations, upcoming sessions, nurse kit and day route, doctor 14-day schedule | Worklists and safety lists. Hiding an item on page 2 would be the bug. A recall in particular must list every patient. |
| Patient page lab reports and vitality trend | Clinical record and trend chart: every entry is needed, and the rows are small. |
| Product catalogue, drips, kits, dropdown pickers | Short reference lists, not growing records. |
| Order detail, invoice, session and report pages | A single record. |

### Tests

| # | Test | Result |
|---|---|---|
| P.6 | Nurse history pages 1, 2 and 3 of 3 (one per page) give 3 different sessions; page 9 falls back to the last page | ✅ |
| P.7 | Patient page sessions paged; the totals stay whole-history on page 2; `page=abc&pageSize=99999` is safe | ✅ |
| P.8 | Smoke: nurse history paged, nurse upcoming NOT paged, patient sessions and reports paged, patient page paged | ✅ all pass (38 pagination checks in total) |
| P.9 | Nurse history pager at 390 and 768 px | ✅ no sideways scroll; sits above the bottom tab bar |
| P.10 | Unit tests, lint, typecheck | ✅ 439 pass, clean |

The only smoke failures (7) are the order confirm and dispatch checks, which need MongoDB running as a replica set. The earlier recall-page and vitals-step failures passed this time.


## Pagination: checked role by role

Signed in as each of the six roles and opened every page in that role's menu (37 page visits), recording which lists are paged and which are whole.

| Role | Paged | Whole on purpose |
|---|---|---|
| Super admin and Admin (same 16 pages) | Audit trail, Products (new), Batches, Prep orders, Enquiries, People | Dashboard previews, Approvals (pending queue whole; "last 7 days" says "showing 20 of N"), Alerts, Recall, Availability, Drips (9 formulas), Quiz, Content, Billing settings. AI Studio is off (404, expected). |
| Doctor (6) | Patients, Plans, Escalation history, and each patient's session history | Dashboard, 14-day schedule, open escalations, letterhead |
| Nurse (5) | Schedule → History | Today, Upcoming, Kit, Me |
| Clinic (5) | Orders, Bookings (History and All tabs; Upcoming shows the pager as soon as there is anything upcoming) | Dashboard, the month's statement, profile |
| Patient (5) | Sessions history, Lab reports | Home (current plan only), profile, drip catalogue |

### Found in this pass: the Products tab

The product catalogue already had 25 products (one full page) and no pager, and it grows with every drug added. It is now paged by the database like the Batches tab:

- The table asks for one page of products, and works out stock only for the products on that page.
- The cards ("Product masters", "At or below reorder" and its two names) are worked out by the database over every matching product, not just the page on screen. The low-stock rule is the same as on the rows: "expiring" takes precedence over "low".
- The "Receive a batch" product picker gets its own light list (name and unit only, no stock figures).

Checked against the old code on live data for every category and several searches: the card figures, the pages stitched back together, and the picker are identical. To exercise the low-stock rule, the reorder levels on five products were raised temporarily: 4 came out low in both old and new code (Ascorbic acid correctly counted as expiring, not low), and all five values were then put back.

| # | Test | Result |
|---|---|---|
| P.11 | Products pages 1 and 3 of 25 at 10 per page, page 99 falls back to page 3, category and search filters, for both admin roles | ✅ |
| P.12 | Products pager at 390 / 768 / 1024 / 1440 px | ✅ no sideways scroll; theme colour on the current page |
| P.13 | Smoke: 175 pass. All pagination checks pass, including the new Products check | ✅ (the 7 failures are the order confirm and dispatch checks, which need a replica set) |


## Pagination: final check

A last pass over the code, every GET API and every paged screen.

### Found and fixed in this pass

Four list APIs still returned everything. No screen reads them as a list, but they are list APIs and two of them grow. They now take `?page=&pageSize=` and send a `pagination` block, like the others:

| API | Returns |
|---|---|
| `GET /api/inventory/masters` | products (one page, stock worked out for that page only) |
| `GET /api/inventory/masters/[id]` | one product's batches (each delivery adds one) |
| `GET /api/drips` | drips |
| `GET /api/kits` | session kits |

The smoke test used to find "Ascorbic acid" by relying on it being on the first page of products. It now searches for it by name, which is the right way to use a paged list.

The smoke "page 2 differs" check read each row's `_id`, but product and kit rows name it `id`. That made every row look the same, and the check failed even though the pages were correct. The check now reads either field.

### Left whole on purpose (unchanged)

- **Audit CSV export:** streams every row, because a download must be complete.
- **Notification bell:** shows the latest 20, with a real unread count.
- The remaining in-code limits each say so on screen or are internal: approvals "showing 20 of N", two dashboard previews, 5 recent ratings next to real totals, the patient dashboard's current plan, and the reference-number helper.

### Live walk, page by page

| # | Test | Result |
|---|---|---|
| P.14 | Every paged API walked two rows at a time as each role that can read it (19 walks across 10 APIs): the pages add up to the total, no row twice, none missing, same order as one fetch | ✅ all 19 exact |
| P.15 | Every paged screen walked as its own role (20 walks, both admin roles): "Showing a–b of N" ranges run back to back, N never changes, the last page ends at N. This includes all 2,590 audit entries over 259 pages. | ✅ all 20 clean |
| P.16 | Clinic sees 19 orders, the same as the super admin: confirmed that every order in the data belongs to that clinic | ✅ expected |
| P.17 | Smoke: 52 pagination checks | ✅ 52 pass, 0 fail (3 skipped: those lists have too few rows for a page 2) |
| P.18 | Unit tests, typecheck, lint | ✅ 439 pass, clean |

The only smoke failures (7) are the order confirm and dispatch checks, which need MongoDB running as a replica set.


## People details, patient records, and what an Admin may read

Found while walking the Super admin menu module by module (Approvals, People). Two questions came out of it: "why can I not click a patient's name?" and "should an Admin see a patient's health information at all?".

### Decisions (from the product owner, for now)

| Question | Decision |
|---|---|
| What does an **Admin** see of a patient? | **Limited view (option B).** Who they are, where, their sessions and counts. Nothing clinical. |
| Which patients may a **physician** open? | **Any patient, for now.** The client may tighten it later. |
| The **super admin**? | Everything, including the full clinical record. |

### What was built

- **A details page for every person in People**, opened by clicking their name: `/admin/users/[id]`. It works for patient, doctor, nurse, clinic and admin:
  - Patient: account, contact, where they live, "care at a glance" (assessment status, plan count, lab-report count, reaction count, numbers only), and a paged list of sessions.
  - Doctor: registration details, nurses working under them, assessments reviewed, plans written, and their sessions.
  - Nurse: council number, who they work under, zones, whether a home location is set for dispatch, patient rating, and their sessions.
  - Clinic: address, GSTIN, monthly target, this month's revenue, order counts by status, and their sessions.
  - Every page has an **Activity** button (that person's rows in the audit trail). The super admin also has **Edit**, and on a patient, **Open clinical record**.
- **Names are links**: People, Approvals (waiting and reviewed), Overview "Recent sessions", the physician's Patients list (which never linked to a patient before), and a **Patient record** button on the review page.
- **One rule in one place**: `patientRecordView(role)` in `lib/auth/rbac.ts` answers "full", "limited" or "none". Physicians are "full" today. To tighten it later ("only patients this physician reviewed or is on call for"), change that one function and its tests.
- **Opening a patient's page is logged** as `record.opened` (kind "patient profile"), like every other read of a patient's record. The privacy policy's promise stays true.

### What an Admin no longer sees

| Where | Before | Now |
|---|---|---|
| Approvals | Age, gender, vitality score, allergy and medication flags | Name, booking, requested drip, submitted time and SLA only. The super admin keeps the rest. |
| People | "Vitality 62" beside every patient | The patient's city |
| `/api/lab-reports` and lab files | Readable (the permission list included Admin) | **403**. Physicians, the patient and the super admin keep access. |
| `/api/plans` | Readable | **403** for Admin |
| `/api/bookings` | Whole document: vitals, checklist, consent, reactions, doses | Scheduling fields only (allow-list) |
| `/api/users` | Patient's allergies, history, medication, emergency contact | Address, city and pincode only |
| Audit trail: list, detail page and CSV export | Symptoms, question and answer, lab file names | "Clinical detail: for the treating physician". The row stays: who, what, when. |

The lists are **allow-lists**, so a field added to a booking or a patient later stays hidden from an Admin until someone decides otherwise. A test reads the real booking schema and fails if a new field has not been decided.

### Tests

| # | Test | Result |
|---|---|---|
| 6.1 | Access rule: physician and super admin full, Admin limited, everyone else none; every role answers | ✅ |
| 6.2 | Admin cannot hold `labs.view` or `plans.view`; no clinical-named permission lists Admin | ✅ |
| 6.3 | Admin-safe user keeps only address, city and pincode; staff records unchanged; input not mutated | ✅ |
| 6.4 | Booking allow-list names only real fields, holds nothing clinical, and every schema field is decided | ✅ |
| 6.5 | Audit detail withheld for Admin on 7 clinical actions and shown to the super admin; other actions unaffected | ✅ |
| 6.6 | Live, as Admin: lab list, lab file by id and plans all 403; bookings carry no clinical field; patient profile keys are 3 | ✅ |
| 6.7 | Live: Riya Mehta (sulfa allergy, lab reports, a plan) shows no clinical word, on the page or in the data the server sends, to Admin or super admin | ✅ |
| 6.8 | Live: the page opens for Admin and super admin; a doctor, nurse, clinic or patient is turned away; a bad id is a 404 | ✅ |
| 6.9 | Live: a physician opens the full record; Admin, nurse, clinic and patient are turned away from it | ✅ |
| 6.10 | Live: opening a patient's page appears in the audit trail | ✅ |
| 6.11 | Live: Admin's audit CSV shows the withheld notice on clinical rows; the super admin's shows the detail | ✅ |
| 6.12 | Pages at 390 / 768 / 1440 px | ✅ no sideways scroll |

### For the client to decide

- **The website tells patients "nobody else".** The privacy policy, the pricing FAQ, the patient profile and the reports page say a patient's record is visible to "you, the reviewing physician and the attending nurse. Nobody else." With any physician allowed to open any patient, and the super admin able to, that is no longer accurate. Suggested wording: *"Physicians at NutriDrip who are involved in your care, and the attending nurse. Every time your record is opened, it is logged."* Not changed here: the words are the client's.
- **Who counts as "their patient".** When the client wants physicians limited to their own patients, a proposal: patients they reviewed, wrote a plan for, or have a booking with, plus anyone with an open emergency (an adverse reaction, or vitals that blocked an infusion) and anyone whose assessment is waiting for any physician. Change `patientRecordView` and add the check to the physician's patient page and Patients list.
- **Patient "Pending" status.** The app never creates a Pending patient (a first phone sign-in creates them Active), and a Pending account cannot sign in. The seed had set one patient to Pending; that is fixed, and V. Iyer now has a birth date and gender too.


### Found in the People walkthrough: account form messages

When adding or editing a person, a short password, a malformed email, a short phone number and an empty name were refused with the validator's own words ("password: Too small: expected string to have >=8 characters"). They now read "password: use at least 8 characters", "email: that address does not look right", "phone: that number does not look right" and "name: enter a name". Smoke checks two of them, so the wording cannot slip back.

### Found in the People walkthrough: no search box

The People page has always filtered by a search in the address bar (`?q=`), but there was no box to type into, for either the super admin or the Admin. It now has the same debounced search box as Inventory and Drips ("Name, email or phone"). It keeps the chosen role and rows-per-page, and the role chips now keep the search too, so "emma" then "Nurse" is nurses called emma. Checked live as both roles, and on a phone. Smoke covers it.


### A physician is told when their team changes

Raised during the People walkthrough: a nurse is created "under" a physician, and that physician dispatches them and answers for their sessions, but only the new nurse was told anything. The physician met the name for the first time in the middle of an approval, and editing a nurse told nobody.

| Event | Who is told |
|---|---|
| A nurse is created under a physician | That physician: "Test Nurse has joined your team. Covers Koramangala, HSR Layout." |
| A nurse is moved to another physician, or to none | Both physicians and the nurse: "has left your team. Now works under Dr. Amit Rao." / "You now work under Dr. Amit Rao" |
| A nurse under a physician stops being active (inactive, suspended, pending) | That physician: "is no longer active" |
| ...and comes back | That physician: "is active again" |
| A name or phone is corrected | Nobody (that would only teach people to stop reading the bell) |

The new nurse's own welcome now names the physician ("You will work under Dr. Sarah Menon"). Every message links to a new **Your nurses** section on the physician's home (`/doctor#team`): each nurse, their zones, their open sessions and their status. Only a physician has a team, so the super admin is not shown it.

The rules are one small pure module (`lib/data/team-notices.ts`, 18 unit tests); the two account routes only send what it returns. Checked live with a throwaway nurse (created, moved between physicians, switched off and on, renamed, then deleted along with the messages the test made): every message arrived, in the right bell, once; the rename said nothing. Checked on a phone; the columns line up.


### Found in the People walkthrough: most account edits left no trace

Reading the audit trail after the Part 4 tests: the edit that moved a nurse to another physician appeared as `—` (nothing changed). The trail recorded only a person's **name and status** on an edit. A change to who a nurse works under, her zones, a council number, a phone number, a home location, or a clinic's **GSTIN**, address, pincode and monthly target was saved with no record of what it had been. The GSTIN is the sharp case: it decides whether an invoice carries CGST + SGST or IGST.

Now every one of those is recorded as a before and after (`worksUnder` by the physician's name; `zones` as a sorted list, because a list of "2 items" made swapping one zone for another look like nothing). A password is never written down, but the row now says `credentials: new password set`. A clinic's `pincode` had also been hidden as a secret (it contains "code"); that is fixed.

Checked live on the test accounts with reversible edits (council number, a zone swapped for another, GSTIN, pincode, a password), all restored afterwards. 13 unit tests (`tests/user-audit.test.ts`).
