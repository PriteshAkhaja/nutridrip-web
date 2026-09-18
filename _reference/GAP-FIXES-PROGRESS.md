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
