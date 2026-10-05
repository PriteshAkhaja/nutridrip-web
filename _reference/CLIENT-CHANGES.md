# Client changes and updates

Changes the client asked for after the gap fixes, newest last. Each item says what changed, in short. The full write-up with test results for items 1–4 is in `GAP-FIXES-PROGRESS.md`; from item 5 on, it lives only here.

---

## 1. Quiz builder: what the old one had that the new one did not

**Added**
- Multiple-choice questions ("tick all that apply"), with an "only this" answer such as "None of these".
- Number questions with a unit, a lowest and highest answer, and whole numbers or decimals.
- Follow-up questions: a question is asked only when an earlier answer calls for it ("How many a day?" only for smokers).
- Drag to reorder questions by a six-dot handle, with mouse, finger or keyboard.

**Fixed**
- A Number question showed nothing to the patient, so the quiz could never be finished.
- A question added to an early section was asked at the very end.
- Editing a retired question quietly made it live again.
- A new question with a key already in use replaced that question without warning.
- "Restore the default set" wiped every edit in one click. It now asks first.
- The server stored any answer at all, such as "banana" to a yes/no question.
- Spaces typed around an answer ("Tired ") were saved.

## 2. Screening answers reach the physician

**Fixed**
- A screening answer ("Yes" to "Are you pregnant?") only showed in the bell. The physician never saw it on the review.

**Added**
- A red box at the top of the review page: "Screening answer — check before approving", listing each answer.
- A red "Screening answer" pill on the patient's row in Approvals.

## 3. The quiz is taken once

**Changed**
- Every "Take the quiz" button on the website now follows the patient's quiz:
  - Never taken: the quiz.
  - Approved or waiting for the physician: **Book a session** (**Book this drip** on a drip page).
  - Declined: **See your results**.
  - Approval ran out: **Retake the health quiz**.
- Opening the quiz page after taking it goes to booking instead.
- Retaking is a choice, from Profile or Home.

**Fixed**
- Home showed two cards with the same message to a patient with no quiz. It now shows one.

## 4. Retaking the quiz safely

**Fixed**
- **"Needs more information" counted as approved.** The patient could book, and a nurse was sent, with no physician approval.
- A decline from the physician did not stop sessions already booked.
- The booking page showed the whole form to a patient whose approval had run out, then refused at the end.
- Home repeated the same sentence in two cards.

**Changed**
- Retake before the physician decides: the new answers **replace** the old. The physician sees one submission, and the old one is marked "Replaced by newer answers".
- Retake while approved: new bookings wait for the physician. Sessions already booked stay, and the physician sees them before deciding. A decline calls them off and tells the patient and the nurse.
- The patient is told what a retake will do before the first question.
- Home has one card: where the approval stands, the next step (Book a session · Hold a slot · Answer the question · Retake · See your results), and a retake link.

## 5. Quiz categories the patient can tap

The client asked for the quiz categories to be clickable. The old quiz only showed "Section 1 of 9" with a bar, not clickable; the new one showed just the current category name.

**Added**
- The 5 categories (Sleep & energy, Diet & hydration, Lifestyle, How you feel, Screening) as steps at the top of the quiz, with "Section 2 of 5".
- Each step shows a tick when finished, or how many are answered ("1/4").
- Tap a **finished** category to go back and change answers; it opens at its first question.
- Tap the **next unfinished** category to carry on where you left off.
- Later categories stay locked until the ones before are done, because follow-up questions and Screening depend on the earlier answers.
- Phone: the row scrolls sideways, keeping the current category in view. Laptop: the row wraps onto two lines, so nothing is hidden from a mouse.

**Safety**
- An optional question left blank counts as done only after the patient has seen it, so an unopened category never shows a tick.
- If going back and changing an answer adds a new follow-up question, "See my results" takes the patient to it first instead of submitting without it.

| # | Test | Result |
|---|---|---|
| 5.1 | Start: five steps, first current, the rest locked; "Section 1 of 5" | ✅ 390 px and 1440 px |
| 5.2 | Finish section 1: tick, section 2 opens; 3–5 stay locked; section 2 counts "1/4" | ✅ |
| 5.3 | Tap section 1: opens its first question. Tap section 2: resumes at its first unanswered question. Tap a locked one: nothing happens | ✅ |
| 5.4 | Spacing: steps 40 px tall, 8 px apart, 12 px below the bar; the current step always in view; no sideways page scroll | ✅ |
| 5.5 | Typecheck, lint, unit tests | ✅ clean, 538 pass |

## 6. "Admin has all permissions, sees all roles and users"

"Admin" here means the **Super admin**. Checked and **no change needed**:
- Super admin already sees every user of every role in People, with each person's profile and a summary for their role.
- Super admin already holds every permission except the ones that belong to one person: a physician's own letterhead, and a patient's own quiz, lab uploads and bookings.
- The Ops Admin role is unchanged.

## 7. Quiz: slide between questions, and swipe on phones

**Added**
- Continue: the next question slides in from the right. Back: the previous one slides in from the left. Tapping a category slides whichever way that category lies.
- Only the question moves; the Back and Continue buttons stay still under the patient's thumb.
- The slide is short (0.26 s) and slows as it lands, with no bounce. Choosing an answer does not replay it.
- Phone swipes: **swipe left** for the next question (only once it is answered), **swipe right** to go back.
- A long question that was scrolled down starts the next one at the top.

**Safety**
- The last question is never sent by a swipe; sending the quiz to the physician needs the button.
- Scrolling, small nudges and slow drags do not count as a swipe, and a swipe that starts in a text or number box is left alone (it selects text there).
- Fixed on the way: a swipe right was also the browser's own "back a page" gesture, which threw the patient out of the quiz and lost their answers. Sideways swipes inside the quiz now belong to the quiz only.
- Phones set to "reduce motion" get no slide, just the next question.

| # | Test | Result |
|---|---|---|
| 7.1 | Continue slides from the right, Back from the left, an earlier category from the left | ✅ |
| 7.2 | Smoothness, frame by frame: 40 → 20 → 9 → 3.7 → 1.4 → 0 px over about 250 ms, only ever moving toward rest; no sideways page scroll in any frame | ✅ |
| 7.3 | Continue button holds still while the question slides; choosing an answer does not replay the slide | ✅ |
| 7.4 | Swipes: left on an unanswered question does nothing; left once answered goes forward; right goes back and stays in the quiz; a scroll, a small nudge and a slow drag do nothing | ✅ |
| 7.5 | "Reduce motion" on: no slide | ✅ |
| 7.6 | Typecheck, lint, unit tests | ✅ clean, 538 pass |

## 8. Quiz: a proper slider (follow-up to 7)

Item 7 slid only the new question in, so it did not feel like moving between screens. Replaced with a real slider.

**Changed**
- Continue: the current question slides **out** to the left **while** the next slides **in** from the right, side by side, like screens in a carousel. Back does the reverse, and so does tapping an earlier category.
- On a phone the question **follows the finger**, and the next (or previous) question shows at the edge as it is dragged.
  - Let go past a quarter of the width, or with a quick flick, and it slides the rest of the way.
  - Let go before that and it springs back.
- Where there is nowhere to go (the question is not answered yet, it is the first, or it is the last) the card stretches a little and springs back.
- When a finger lets go, the slide carries on from where it was, covering only the distance left, rather than restarting.

**Safety** (as in 7): the quiz is never sent by a swipe; a scroll is never taken for a swipe; the browser's own "back a page" swipe stays off inside the quiz; "reduce motion" turns the slide off.

| # | Test | Result |
|---|---|---|
| 8.1 | Continue: old and new move together, exactly one card-width apart in every frame (24 of 24); the new one lands in place in about 300 ms; the old one is removed after | ✅ |
| 8.2 | Back and earlier categories slide the other way; no sideways page scroll in any frame | ✅ |
| 8.3 | Drag 70 px: card follows, next question peeks in; let go: springs back. Past a quarter: slides on. Right: back. A 65 px flick: slides on | ✅ |
| 8.4 | Unanswered: gives at most 56 px, nothing peeks in, springs back. A vertical scroll does not move it. Last question: a swipe left does not send the quiz; a swipe right still goes back | ✅ |
| 8.5 | "Reduce motion": the question changes at once | ✅ |
| 8.6 | Typecheck, lint, unit tests | ✅ clean, 538 pass |

## 9. Nurse checklist: completed steps can be edited

A nurse who entered something wrong could not go back: a ticked step was only a struck-through line. A mistyped baseline reading (say SpO₂ 91 instead of 98) blocked cannulation until a physician cleared it, with no way for the nurse to fix the typo.

**Added**
- Every ticked step now has a button:
  - **Record baseline / closing vitals → Edit.** Opens the reading with its values filled in. The nurse fixes the wrong value and picks why (Typing mistake · Measured again · Typed in the wrong box · Other, with a note). Save stays off until something changes and a reason is chosen.
  - **Every other step → Reopen.** The step becomes the one to do again. Later steps stay ticked, but nothing further can be ticked until it is closed again.
- A reading corrected **into range lifts the block** at once, and the nurse carries on. One corrected **out of range blocks again** and needs the physician, like a new reading.

**Safety**
- The reading is corrected **in place**, and what it said before is kept on it, with who, when and why. Nothing is overwritten silently.
  - In place matters: adding a second reading would have counted as the closing vitals, letting the nurse skip the real closing reading.
- Any correction that touches an out-of-range reading **tells the physician at once**, with the old and new values, the reason and whether the block lifted. It is also in the audit trail.
- Shown wherever readings are read:
  - The nurse's report and the physician's vitals screen show the old values ("was 122/78 · 74 bpm · SpO₂ 91%…").
  - The patient's pages say only "Corrected by your nurse at 12:41 pm · Typing mistake", so a mistyped number does not alarm them.
- Same limits as a new reading. Only the session's own nurse can correct, and only while the session is running.
- Consent and the kit's batch numbers are not changed by Reopen, only the tick.
- A server started before this change refuses a correction with "restart it" instead of losing the history.

| # | Test | Result |
|---|---|---|
| 9.1 | ND-4417 as in the client's screenshot (SpO₂ 91, stuck at "Prime the line"): 15 ticked steps each have Edit or Reopen | ✅ |
| 9.2 | Edit → "Correct the baseline reading", values filled in; Save off until changed and a reason chosen; saved → "all readings in range, the block has lifted" | ✅ |
| 9.3 | Fixed in place (still one reading), old values kept with nurse, time and reason; physician notified with before → after; audit row | ✅ |
| 9.4 | Back on the checklist the block is gone and "Prime the line" can be ticked | ✅ |
| 9.5 | Reopen "Draw up and label every additive": it becomes the step to do; a later step is refused until it is ticked again | ✅ |
| 9.6 | Corrected out of range: blocked again, both corrections kept, back on the physician's screen with the old values | ✅ |
| 9.7 | Refused: "Other" without a note, a reading not yet taken, impossible values, another nurse, a patient, a server not yet restarted (nothing changed) | ✅ |
| 9.8 | Patient's page shows "Corrected by your nurse" without the old number; nurse's report shows both corrections with old values | ✅ |
| 9.9 | Spacing at 390 px: Edit/Reopen 36 px tall, 15 px from the row's top and right edge (its padding); no sideways scroll | ✅ |
| 9.10 | Production build, typecheck, lint, unit tests | ✅ clean, 542 pass |

ND-4417 was put back exactly as it was after testing.

**9, follow-up:** on the correction screen, a greyed-out **Save the correction** gave no reason and looked broken (it was waiting for a reason to be chosen). It now says underneath what it is waiting for: "Change the value that was entered wrongly", "Choose why it is being corrected", "Say what was wrong with it" or "Fill in every reading".

## 10. The patient's code on their Home screen, and a real consent code

The client asked for the patient to get a code, read it to the nurse, and see it on their Home screen.

**Fixed: consent "by code" was not real**
- The consent screen asked the nurse for the **last 4 digits of the patient's phone number**, and showed that number on the same screen.
- Nothing was sent to the patient and nothing was checked, so it recorded the nurse's say-so as the patient's consent.

**Added**
- **A real consent code.** On the consent screen the nurse taps **Send the code to the patient**. The patient gets a 6-digit code and reads it out, and the nurse types it into six boxes.
  - It is checked: one session only, ten minutes, a few tries ("That code is not right — 4 tries left"), used up once it matches.
  - The nurse sees only where it was sent (••••0003), never the code.
- **The code on the patient's Home**, at the very top, for both the prescription code and the consent code. It shows:
  - "Your nurse is asking for a code"
  - what it is for
  - the six digits, large
  - the time left
  - "Only read it to the nurse who is with you. NutriDrip will never phone or message you to ask for it."
- It **appears by itself** within a few seconds of the nurse pressing Send, and **disappears** once it is used or expires.
  - The patient does not have to refresh. The app checks every 5 seconds, only while a session is under way and the app is open.
- The same card shows on the patient's session page. The bell notice now opens Home.

**Safety**
- Codes are stored locked (encrypted) and hashed, never as plain numbers. Only the patient the code was sent to can see it; a nurse asking for the patient's codes is refused.
- The consent record says a checked code was given ("verified"), not the code itself.
- A server started before this change refuses to send consent codes with "restart it", instead of failing halfway.

| # | Test | Result |
|---|---|---|
| 10.1 | ND-4419, nurse and patient side by side: prescription code sent, appears on the patient's Home by itself in about 4 s, opens the prescription, then leaves Home | ✅ |
| 10.2 | The old way (4 digits of the phone number) refused; six digits with no code sent refused | ✅ |
| 10.3 | Nurse's consent screen: Send button instead of "Last 4 digits"; after sending, masked number and six boxes, no code on screen | ✅ |
| 10.4 | Consent code on the patient's Home; a wrong code gives "4 tries left"; the right code records consent (marked "verified") and returns the nurse to the checklist; the card then leaves Home | ✅ |
| 10.5 | A nurse cannot fetch a patient's codes; codes are not stored in plain text | ✅ |
| 10.6 | Card at 390 px: 20 px padding, full width inside the 20 px margins, 16 px to the next card, no sideways scroll | ✅ |
| 10.7 | Unit tests for the locked codes (opens its own box, never shows the code, refuses a tampered box); production build, typecheck, lint | ✅ clean, 546 pass |

ND-4419 was put back exactly as it was after testing.

## 11. Feedback after a finished session: the nurse and the session

Before, there was one "How was it?" rating, at the bottom of the patient's session report, so a patient only found it if they opened the report. Nothing asked them.

**Added**
- **Two parts:**
  - **Your nurse** (by name), "How was Emma's care?": 1–5, optional comment.
  - **Your session**, "How do you feel after your drip?": 1–5, optional comment.
  - Send needs both, or only the session when no nurse ran it.
- **Asked on Home once the session is done**, as a card reading "How was it with Emma?" with the drip, booking number and date.
  - One at a time: the latest finished session not yet rated, within two weeks of it.
  - **Not now** puts it away on that device. The same form stays on the session report, and the "report is ready" notice now says "Tell us how it went".
- After sending: "You rated Emma 5/5 and the session 2/5", with either "Emma sees your rating on their record" or, for a low rating, "Your physician has been told".

**Who sees what**
- **The nurse** is told their own rating straight away ("S. Krishnan rated your care · 5/5"). Their session report shows both parts.
- The nurse's average (their profile, and People) counts **only the nurse part**, so a patient feeling dizzy does not count against the nurse.
- **The physician** is told when either part is 2 or less, with both halves ("Nurse 5/5 — … · Session 2/5 — Felt dizzy…").
- Older single ratings still count, read as both parts. Every rating is in the audit trail ("Feedback given").

| # | Test | Result |
|---|---|---|
| 11.1 | ND-4415 (S. Krishnan, nurse Emma, finished today): Home asks "How was it with Emma?" with both parts | ✅ |
| 11.2 | "Not now" puts it away, it stays away after a reload, and it is asked again on a cleared device | ✅ |
| 11.3 | Send off until both parts are rated; sent 5/5 and 2/5 with comments; the thank-you names Emma and says the physician was told | ✅ |
| 11.4 | Stored in two parts; the nurse told "rated your care · 5/5"; the physician told "Low rating" with both halves | ✅ |
| 11.5 | Home stops asking once rated; the report shows it given; the nurse part cannot be left out; another person cannot rate it | ✅ |
| 11.6 | Nurse's report shows "Your care 5/5" and "The session 2/5"; the nurse's record counts only their own part | ✅ |
| 11.7 | Card at 390 px: 20 px padding, full width, rating buttons 52 px tall, 8 px apart, 16 px to the next card, no sideways scroll | ✅ |
| 11.8 | Unit tests (both parts, older single rating, low on either part); production build, typecheck, lint | ✅ clean, 550 pass |

ND-4415 was put back exactly as it was after testing.

## 12. Back buttons go where you came from; physicians see feedback

**Fixed: back buttons**
- Four pages had one fixed Back destination but are opened from several places:
  - The nurse's **session report** and **checklist** always went to Today, even when opened from Schedule (the client's screenshot), the checklist or the bell.
  - The patient's **session report** always went to Sessions.
  - The patient's **treatment plan** always went to Home.
- Now every Back arrow in the nurse and patient apps goes to the page it was opened from, with the matching label ("Back to the schedule", "Back to today", "Back to home").
- Coming back from a step screen does not change that: after vitals or the prescription, the checklist's Back still goes to Schedule if that is where it was opened from.
- Opened fresh (a new tab, a link), a page goes to its usual parent as before.
- The step screens (vitals, consent, kit, monitor, prescription, adverse event) already returned to the checklist correctly; unchanged.

**Added: feedback for the physician**
- The physician saw feedback nowhere. Even the "Low rating" notice opened their Schedule, which does not show ratings.
- **Physician's home → Patient feedback**:
  - the 5 latest ratings on their sessions: patient, booking, drip, date
  - nurse and session ratings with comments, and a "Low rating" marker
  - the count of low ratings in the last 30 days
- **Patient record → Sessions → a Feedback column**: "Nurse 5/5 · Session 2/5" and what was said, low ratings in amber.
- The **"Low rating" notice now opens the patient's record**, where the feedback is.

| # | Test | Result |
|---|---|---|
| 12.1 | Nurse: report from Schedule → "Back to the schedule", and pressing it lands there (the screenshot's case); from Today → "Back to today" | ✅ |
| 12.2 | Nurse: checklist from Schedule → Schedule; a step screen → the checklist; back on the checklist, still Schedule | ✅ |
| 12.3 | Opened fresh → usual parent (nurse report → Today; patient report → Sessions) | ✅ |
| 12.4 | Patient: report from Sessions → "Back to sessions"; from Home (e.g. the bell) → "Back to home" | ✅ |
| 12.5 | Physician's home: Patient feedback with S. Krishnan (ND-4415), Low rating, "Nurse · Emma Fernandes 5/5 Very well", "Session 2/5 Dont know", "1 low rating in the last 30 days" | ✅ |
| 12.6 | Patient record: Feedback column "Nurse 5/5 · Session 2/5 / Very well · Dont know"; no sideways scroll at 1440 px | ✅ |
| 12.7 | Unit tests for the back rule (5); production build, typecheck, lint | ✅ clean, 555 pass |

These checks only read data; nothing was written except sign-ins.

**12, follow-up:** on the physician's Patient feedback card, each score was pushed to the far edge of its column, so on a wide screen the nurse's "5/5" sat beside the word "Session" and read as the session's score. Each part is now one block: the label on top ("NURSE · EMMA FERNANDES" / "SESSION"), the score and the comment underneath ("5/5 Very well"), the low one in amber. Checked at 1650, 1440 and 390 px: every score directly under its own label, 12 px from its comment, no sideways scroll.

## 13. Rescheduling for the patient, and a fee for last-moment changes

**Before**
- A patient could move a session only from the Sessions tab, and never inside the last 4 hours: it was refused, with "cancel instead".
- The ₹500 late-cancel fee was worked out but never saved on the booking (only in the audit trail).
- It was also worked out when a clinic or the team cancelled, as if the patient had.

**Added**
- **Move it / Cancel this session on Home**, on the "Next session" card, as well as on Sessions.
- **Moving inside the late window is allowed, for a fee**:
  - The patient is told first: "Your slot is less than 4 hours away, so moving it now costs ₹500, added to this session".
  - The button says **Move for ₹500**. Nothing is charged without that tap; the server refuses a late move that has not accepted the fee.
  - The nurse is told "Session moved at the last moment", with the old and new times.
  - Outside the window, moving stays free, with no extra step.
- **Fees are saved on the session** ("Moved late" / "Cancelled late", amount, when), and shown to the patient on Home, Sessions and their report: "Moved late · ₹500 — added to this session".
- **Billing → Late changes by patients** (super admin and admin):
  - The window (hours), the fee to move and the fee to cancel. Defaults: 4 hours, ₹500, ₹500.
  - "What patients are told" updates as you type.
  - **Recent late-change fees**: patient, session, moved or cancelled late, amount, unpaid.
- **Every page that states the rule now follows the settings**: FAQs, pricing, how it works, terms, the home page FAQ, the drip pages and the booking screen.
  - Several said "inside 4 hours a session cannot be moved", which is no longer true.
  - The sentence always says "late fee", the word a patient searches for.

**Fixed along the way**
- The late-cancel fee is now saved on the booking.
- A cancellation or move by a clinic or the team never charges the patient.
- The Terms and Privacy pages were built once, when the app was built. That froze the fees into them, and showed a signed-in patient "Sign in" in the header. They are now drawn on each visit like the rest of the site.

| # | Test | Result |
|---|---|---|
| 13.1 | ND-4419 (slot already passed, so inside the window): Home offers Move and Cancel; Move says "less than 4 hours away… ₹500" and "Move for ₹500" | ✅ |
| 13.2 | A late move without accepting the fee is refused with the amount and changes nothing; confirmed, it moves and records "late_reschedule ₹500, Moved from … to …"; the nurse is told it was a last-moment move | ✅ |
| 13.3 | Home and Sessions show "Moved late · ₹500 — added to this session" | ✅ |
| 13.4 | ND-4421 (47 hours away): moved free, no fee, no confirmation | ✅ |
| 13.5 | A late cancel by the patient records "late_cancel ₹500"; a late move by the team charges nothing | ✅ |
| 13.6 | Billing shows 4 / ₹500 / ₹500 and the sentence; typing ₹300 updates the preview; saved | ✅ |
| 13.7 | After saving: FAQs, pricing, how it works, terms and the home FAQ all say "(₹300 to move, ₹500 to cancel)", none says "cannot be moved"; the patient's button says "Move for ₹300" | ✅ |
| 13.8 | Recent late-change fees lists "A. Bhatt · ND-4419 · Moved late · ₹300 · Unpaid" | ✅ |
| 13.9 | Terms page now knows who is looking (a signed-in patient sees "Book a session", not "Sign in") | ✅ |
| 13.10 | Unit tests (policy: window, fees, wording, never a negative fee; FAQs follow the settings); production build, typecheck, lint | ✅ clean, 561 pass |

ND-4419, ND-4421 and the billing settings were put back exactly as they were after testing.

**13, follow-up: marking a late fee paid.** A fee could never leave "Unpaid", because the app takes no payments yet, and the list showed the whole booking's payment status rather than the fee's own.
- Each fee now has **its own status**: Unpaid, Paid (and how) or Waived. Charging a fee no longer changes the booking's payment status.
- **Billing → Recent late-change fees**, on each fee:
  - **Mark as paid**, choosing Cash, UPI, Card or Bank transfer. It then reads "Paid · UPI · 24 Sept".
  - **Waive**, for goodwill.
  - **Undo**, if either was a mistake.
  - Unpaid fees are listed first, under "₹1,000 unpaid across 2 fees" (or "Nothing owed").
- Only billing staff (super admin, admin) can do this. Every change is in the audit trail, with before and after and the method.
- The patient's fee line shows "₹500 · Paid" / "Waived" and "Late-change fee settled — nothing more to pay".
- Taking payment inside the app (a payment gateway) is still not built; this records payments taken outside it.

| # | Test | Result |
|---|---|---|
| 13.11 | Billing shows the fee Unpaid with Mark as paid / Waive, and "₹500 unpaid across 1 fee" | ✅ |
| 13.12 | Mark as paid → UPI: "Paid · UPI · 24 Sept", "Nothing owed"; stored with who and when; audit "billing.late_fee.paid" unpaid → paid, UPI | ✅ |
| 13.13 | The patient's Home shows "Paid" and "settled — nothing more to pay" | ✅ |
| 13.14 | Undo returns it to Unpaid; Waive gives "Waived", no method; a patient cannot settle a fee | ✅ |
| 13.15 | Typecheck, lint, unit tests | ✅ clean, 561 pass |

**13, decision (24 Sept): fees stay "Unpaid" until payments exist.** There is no payment in the app yet, so the manual **Mark as paid / Waive / Undo** added just above were taken out again, with the server route behind them. Every late-change fee shows **Unpaid**, under the total still owed ("₹500 unpaid across 1 fee"). When payments are added, the patient pays the fee in the app and it turns to **Paid** automatically; that is the end-to-end version. Each fee keeps its own status field, ready for that, and the patient's screens already show "Paid" or "Waived" once it is set. ("Waived" means the fee is cancelled and forgiven: the patient does not have to pay it.)

**13, open question for when payments are built: when is a late fee collected?** Today nothing requires it before the session; it stays owed with the session. Options: (a) with the session's own payment, and the session is never blocked (recommended: care is not held up over a fee with the nurse at the door); (b) paid in the app before the nurse can start; (c) collected by the nurse at the door, shown on their checklist. To decide with the client.


---

## 14. Clinic pays before its order is confirmed

**Asked:** "clinic side payment confirm should be there". When a clinic places an order, the payment has to be confirmed before the order goes ahead.
**Decided (24 Sept):** the clinic records its payment, and NutriDrip checks the money arrived. Every clinic pays first by default. A trusted clinic can be switched to "on credit".

**How it works**
- A clinic's new order starts as **Draft · Awaiting payment**.
- The clinic's order page shows **"Pay ₹X to confirm this order"**, with:
  - NutriDrip's UPI ID and bank details;
  - a small form for how they paid (UPI, bank transfer or cheque), the reference or UTR, and the date;
  - an **I've paid** button.
- The order becomes **Payment to check**, and super admins and admins get a bell.
- On the order, the team presses either:
  - **Payment received**; or
  - **Not received**, with a note. The note goes back to the clinic ("We could not find your payment: …") and the clinic can record it again.
- **Confirm & reserve stays off until the payment is received.** The reason is written under the button, and the server refuses it too (409), not only the screen.
- If an order is cancelled after its payment was received, it is marked **Refund due**, and the clinic is told the amount is owed back.
- The invoice for a paid order says "Paid in advance on … by …, ref …. Nothing further is due", instead of "payable within 30 days".
- Order lists show a second pill next to the status:
  - Awaiting payment;
  - Payment to check (the team) or Payment being checked (the clinic);
  - Paid;
  - Refund due.

**Settings**
- **Billing → Where clinics pay:** the UPI ID, account name, bank, account number and IFSC that clinics are shown. These are checked as they are entered (a UPI ID must look like name@bank; an IFSC has 11 characters; an account number needs a name and an IFSC). Until this is filled in, clinics see "payment details not set up yet".
- **People → a clinic → Payment for orders:** "Pays before each order is confirmed" (the default), or "On credit — pays within 30 days of the invoice". Orders from a clinic on credit skip the payment step. Each order remembers the terms it was placed under.

**Who can do what:** only the clinic that owns the order, or billing staff, can record a payment. Only super admin or admin can mark it received or not received. A clinic cannot mark its own payment received (403). Every step is in the audit trail as `order.payment.submit` / `received` / `not_received`.

**Not built:** taking the money inside the app (a payment gateway). This records payments made outside it: UPI, bank transfer or cheque. The refund itself is also paid outside the app; the order only records that it is due.

**Note for the demo data:** the seeded clinic drafts (PO-2026-0111, 0112, 0114) were placed before this change, so they now also wait for a payment before they can be confirmed.

| # | Test | Result |
|---|---|---|
| 14.1 | Unit tests: who must pay, what holds Confirm up, reference format, invoice terms line | ✅ 7 new, 568 pass |
| 14.2 | Typecheck, lint, production build | ✅ clean |
| 14.3 | A clinic's new order starts "awaiting", not on credit | ✅ |
| 14.4 | Clinic page: "Pay ₹10,600 to confirm this order"; "not set up yet" before the payee is saved; UPI ID and IFSC shown after | ✅ |
| 14.5 | Payee: saved by super admin (IFSC upper-cased); a bad UPI ID refused; a clinic cannot change it | ✅ |
| 14.6 | Admin page: "Waiting for the clinic's payment", Confirm off with "Not paid yet" under it; the API confirm refused (409) | ✅ |
| 14.7 | Clinic records a bank transfer through the form (the field is relabelled "UTR number"); stored; admins get a bell; the clinic cannot mark it received (403) | ✅ |
| 14.8 | Admin page: "Payment to check" with the reference; confirm still refused; Not received needs a note; the note is stored and the order goes back to awaiting | ✅ |
| 14.9 | Resubmit, Payment received, Confirm & reserve, the Paid screens, refund due on cancel, credit clinics, 390 px | ⏳ not yet run live, see below |

The live test stopped partway, after 14.8, and its automatic clean-up did not run. It left one test order, **PO-2026-0115** (patient ref "LIVE-PAY", ₹10,600, Draft), three bells about it, its audit rows, and a test payee (nutridrip@hdfcbank) in Billing. None of it touched stock.


---

## 15. Service zones and pincodes, managed by the super admin

**Asked:** make the pincodes dynamic instead of fixed in the code, managed by super admins.
**Before:** the 14 zones and their pincodes were written into the code (`src/lib/zones.ts`). Adding a pincode needed a developer and a new release.

**Now: Platform → Service zones** (super admin only; an ordinary admin does not see it, and is refused if they open the address).
- A table of every zone, showing its pincodes, hours, status and how many active nurses cover it.
- **Add a zone:** a name, the pincodes (typed with commas or new lines), opening and closing times, and a status:
  - **Full cover**;
  - **Limited** (we serve it, with shorter hours);
  - **Paused** (kept, but not offered to patients).
- **Edit** any zone. Renaming a zone also renames it for every nurse who covers it, so no nurse loses coverage because of a new name.
- **Delete** only a zone no nurse covers, and never the last zone. Otherwise the screen says to pause it instead.
- **Check a pincode:** type a pincode to see which zone it is in, or whether it is not served, or is in a paused zone.
- A warning names the zones no nurse covers. Patients there can still book, and get the nearest nurse.
- It is checked as you type, and again by the server:
  - a pincode must be six digits and cannot start with 0;
  - a pincode cannot be in two zones (the error names the zone that already has it);
  - two zones cannot share a name;
  - the closing time must be after the opening time.
- Every add, change and delete is in the audit trail (`zone.create` / `zone.update` / `zone.delete`), with the before and after.

**What follows the list straight away:**
- **Booking:** the pincode check and the note under the pincode field.
- **Welcome and Profile:** the address screens.
- **Consult form:** the pincode hint.
- **Nurse matching:** automatic assignment, and the nurse list a physician sees.
- **People:** the "Zones covered" chips on a nurse, where paused zones are marked "· paused".
- **Public site:** the Zones page, the FAQs ("We cover N zones…"), the Pricing FAQ, the Home figure, the About figures and the top banner ("N zones across Bengaluru").

A paused zone is not counted on the public site and is not offered at booking.

**For an existing database:** the first time any page reads the zones, the 14 launch zones are written in, so nothing changes until the super admin edits them. `npm run seed` also resets them to the 14.

| # | Test | Result |
|---|---|---|
| 15.1 | Unit tests: served / paused / newly added pincodes; pincode, name, hours and clash rules; the count in site copy; FAQ answer follows the zones; consult hint and nurse ranking take the saved list | ✅ 13 new, 581 pass |
| 15.2 | Typecheck, lint, production build | ✅ clean |
| 15.3 | Public Zones page and banner show 14; the super admin's page lists them with nurse counts | ✅ |
| 15.4 | Check a pincode: 560095 → Koramangala; 560064 → not in any zone | ✅ |
| 15.5 | Add "Yelahanka" with 560064, 560095: stopped before sending, "560095 is already in Koramangala"; with 560064, 560063 it saves, and shows "No nurse covers … Yelahanka" | ✅ |
| 15.6 | At once: the public Zones page lists Yelahanka and says 15, the FAQ says "We cover 15 zones", and the Home figure is 15 | ✅ |
| 15.7 | Pause it: the pill reads Paused, the header says "1 paused", it leaves the public page (back to 14), and the pincode check says "which is paused" | ✅ |
| 15.8 | Koramangala (a nurse covers it): "Cannot be deleted while a nurse covers it", with no Delete button | ✅ |
| 15.9 | Delete Yelahanka: asks "Delete Yelahanka for good?", then it is gone | ✅ |
| 15.10 | Edit on the last row scrolls the form into view; 390 px has no sideways page scroll | ✅ |
| 15.11 | `npm run smoke` gained: admin refused, clash refused, new zone books, paused zone refused, uncovered zone deleted, covered zone refused, rename carried to nurses | added, not run (it writes test data) |

**Found and fixed during testing:** the first page load wrote the 14 launch zones three times. The page header, the page title and the page body each saw an empty list at the same moment, which gave 42 zones and a count of 42 on the site. Seeding now happens once per server, and the unique indexes are built before the first write, so two servers starting together cannot both write the zones. The 42 duplicate rows came from my test server and nobody had edited them; they were removed, and the next load wrote the 14 correctly. The zones collection now has exactly 14, with unique indexes on name and pincode. The test zone was added and removed through the screen, so its three `zone.*` audit rows per run remain in the audit trail.


---

## 16. Booking slots follow the zone's hours, and only times a nurse is free

**Asked:** the old build offered a slot every hour (08:00 to 19:00); the new one had six fixed times. Should it be hourly?
**Before:** six fixed times (08:00, 10:00, 11:30, 13:30, 16:00, 18:30) for everyone:
- they ignored the zone's hours: Hebbal (09:00–17:00) could still book 08:00 and 18:30;
- a time was never full: any number of patients could book Friday 10:00 with one nurse in the zone;
- nurse assignment did not look at the time, so a nurse could be given two sessions at once.

**Now:**
- **Times follow the zone.** Each zone offers a time every hour (or every 30, 45, 90 or 120 min) from opening until the last slot that fits before closing. For example:
  - Koramangala, 07:00–20:00: 07:00 … 19:00, 13 a day;
  - Hebbal, 09:00–17:00: 09:00 … 16:00, 8 a day.
- **Only times a nurse can come.** A nurse is busy for the length of a session plus 45 minutes' travel. A time shows as **taken** (greyed, crossed out, and not pressable) when every nurse who works that zone is busy then. Sessions still waiting for a nurse count too. Times within the next hour show **too soon**.
- Each day button says how many times are free ("10 free"), or "full".
- **Nothing is picked for the patient.** The Summary says "Pick a time", and the button stays off until they choose one.
- **Where** now comes before the day and time on the Book screen, because the times depend on the address. Changing the pincode redraws the times.
- **Move it** (rescheduling) uses the same picker, for the session's own address. The session does not block its own time.
- **Service zones → Times offered:** a new field on each zone (every 30 / 45 / 60 / 90 / 120 min). A preview shows what patients will see ("Patients see 09:00, 10:00 … 16:00 · 8 a day"). The table and the public Zones page show "every hour" under the hours.

**Enforced on the server, not only on screen:**
- Booking or moving to a time off the zone's grid is refused (422), naming the zone's hours: "08:00 is not a bookable time. Hebbal takes bookings every hour from 09:00 to 16:00."
- Booking or moving to a time with no free nurse is refused (409): "No nurse is free at that time any more. Pick another time." The picker then reloads.
- Automatic nurse assignment (on booking, on the physician's approval, on "reassign") skips nurses busy at that time.
- Assigning a nurse by hand who already has a session then is refused, with that session's number and time.
- If a moved session's nurse is busy at the new time, it goes to a free nurse. Both nurses are told, and the change is in the audit trail. If nobody is free, the admins are alerted.
- A zone with no nurse of its own uses all nurses, as dispatch already did, so patients there can still book.
- All times are India time, whatever timezone the server runs in.

**Not changed:** days are still released 5 at a time, from tomorrow.

| # | Test | Result |
|---|---|---|
| 16.1 | Unit tests: slot times from hours and step; India time; releasing days; clash with travel; free nurses (busy, waiting, other zones, outside the pool); free / taken / too soon on the grid; the server's refusals | ✅ 12 slot tests (plus 1 zone test), 590 pass in all |
| 16.2 | Typecheck, lint, production build | ✅ clean |
| 16.3 | Grid: Koramangala every hour, 07:00 … 19:00, 13 a day, 5 days from tomorrow; Hebbal 09:00 … 16:00; an unserved pincode gets no times | ✅ |
| 16.4 | ND-4421 (26 Sept 15:11, nurse Sunita, Indiranagar's only nurse): Indiranagar's 14:00, 15:00 and 16:00 are taken, 13:00 and 17:00 free, "10 free"; HSR Layout (Emma) unaffected | ✅ |
| 16.5 | Refused before anything is written: 07:30 in an hourly zone (422), 08:00 in Hebbal (422, naming its hours), 14:00 in Indiranagar on the 26th (409) | ✅ |
| 16.6 | Book (390 px): Where comes before the times; "Pick a time" and the button is off; picking 12:00 fills the Summary; a Hebbal pincode redraws 09:00 … 16:00; taken times are crossed out and not pressable; no sideways scroll | ✅ |
| 16.7 | Move grid for ND-4421 uses its own zone and does not block itself; an off-grid move is refused and the session is unchanged; another patient cannot read its grid (403) | ✅ |
| 16.8 | Zone form: "Times offered", preview "09:00, 10:00 … 16:00 · 8 a day", every 90 min previews "09:00, 10:30 … 15:00 · 5 a day"; the Opens, Closes and Times offered boxes line up | ✅ |
| 16.9 | `npm run smoke` updated: books a real free slot from the grid, and checks an off-grid time is refused | updated, not run (it writes test data) |

The live test was read-only: the booking count stayed at 4, the zones and ND-4421 were unchanged, and no audit rows were written apart from the test's sign-ins. The Move dialog itself was not opened on screen, because ND-4421's patient has not finished the welcome step; its grid and refusals were checked through the server.


---

## 17. The menu entry for the page you are on goes back to its main view

**Reported:** while editing a quiz question, clicking **Quiz builder** in the sidebar did nothing; the editor stayed open.
**Why:** the editor lives in the page's memory, and the sidebar link points at the same address the page is already on, so nothing changed.

**Fixed, for every screen at once** (all console sidebars, and the patient and nurse bottom tabs). Clicking the entry for the page you are on now:
- closes any open editor or form on that page, such as a quiz question, a new drip, a zone, Add person or Receive stock;
- drops anything in the address that opened something (for example People `?edit=…`);
- reloads the page's data;
- scrolls to the top;
- on a phone, also closes the menu drawer.

Clicking any other entry works as before, and Ctrl-click or middle-click still open a new tab. Anything half-typed in the closed form is discarded. Clicking the menu is taken as "leave this", like clicking any other page.

| # | Test | Result |
|---|---|---|
| 17.1 | Quiz: editing "wake-tired", then **Quiz builder** in the menu: back to the list with "Add a question" and the sections, at the top, address `/admin/quiz` | ✅ |
| 17.2 | Another entry (Service zones) from the editor navigates as before | ✅ |
| 17.3 | Service zones: **Add a zone** open, then **Service zones**: the form closes | ✅ |
| 17.4 | Drip builder: **Create a drip** open, then **Drip builder**: back to the library | ✅ |
| 17.5 | People opened with `?edit=…`, then **People**: the address loses `?edit=` and the list shows | ✅ |
| 17.6 | Phone (390 px): menu drawer open over the quiz editor, then tap **Quiz builder**: the drawer and the editor both close | ✅ |
| 17.7 | Typecheck, lint, production build, unit tests | ✅ clean, 590 pass |

The live test only opened editors and left them; nothing was saved.


---

# Summary · all client changes at a glance (24 Sept 2026)

Every item was re-checked on 24 Sept on a fresh copy of the demo data (see "Checked end to end" below).

## 1 · Quiz builder ✅ DONE
- Added multiple-choice, number and follow-up questions, and drag to reorder.
- Fixed number questions the patient couldn't answer, new questions landing at the end, and "Restore defaults" wiping edits without asking.

## 2 · Screening answers reach the physician ✅ DONE
- A red "Screening answer" box on the review page and a pill in Approvals.

## 3 · The quiz is taken once ✅ DONE
- "Take the quiz" follows the patient: book, see results, or retake. It no longer reopens a quiz already taken.

## 4 · Retaking the quiz safely ✅ DONE
- Fixed "Needs more information" counting as approved.
- A retake replaces unread answers; a decline calls off booked sessions and tells the patient and the nurse.

## 5 · Quiz categories the patient can tap ✅ DONE
- Five category steps with ticks and "1/4" counts; finished ones reopen, later ones stay locked.

## 6 · Admin permissions ✅ NO CHANGE NEEDED
- "Admin" meant the Super admin, who already sees every role and user.

## 7–8 · Quiz slider and swipe ✅ DONE
- Questions slide like a real slider and can be swiped on a phone; "reduce motion" is respected.

## 9 · Editable nurse steps and vitals corrections ✅ DONE
- A completed step can be edited, with the reason recorded.
- Vitals can be corrected; the history is kept, and an out-of-range correction blocks the infusion again.

## 10 · The patient's code on Home, and a real consent code ✅ DONE
- The patient sees the code to read to the nurse, and it opens the prescription.
- Consent uses its own one-session code.

## 11 · Feedback after a session ✅ DONE
- The patient rates the nurse and the session; a rating of 2 or less goes straight to the physician.

## 12 · Back buttons, and physicians see feedback ✅ DONE
- Back goes where you came from; the physician's home shows patient feedback and low ratings.

## 13 · Patient reschedule and last-moment fee ✅ DONE
- Move or cancel from Home. Inside the window (4 h by default) it costs ₹500, editable in Billing.
- Fees show "Unpaid" until payments are built.
- Open question: when is a late fee collected?

## 14 · Clinic pays before its order is confirmed ✅ DONE
- The clinic records its payment; admin marks it received or not received; Confirm stays off until it is received.
- "On credit" per clinic, payee details in Billing, refund due on cancel.

## 15 · Service zones managed by the super admin ✅ DONE
- Add, edit, pause or delete zones and pincodes; a zone a nurse covers can't be deleted.
- Booking, nurse matching and the public site all follow the list.
- The seed and an empty database both get the 14 defaults automatically.

## 16 · Booking slots follow zone hours and free nurses ✅ DONE
- Slots are hourly by default, with the step set per zone.
- A time shows "taken" when no nurse is free (session plus 45 min travel).
- The server refuses off-grid or taken times; a nurse is never given two sessions at once.

## 17 · Sidebar returns to the page's main view ✅ DONE
- Clicking the menu entry for the page you're on closes an open editor or form (quiz, drips, zones, People) and goes back to the top.

## Found on the way ✅ FIXED
- **Confirm & reserve failed** with "Transaction numbers are only allowed on a replica set". MongoDB on this PC was switched to a replica set (`rs0`), and `.env` now has `?directConnection=true`. The app now shows a clear message if a database without a replica set is used.
- **The zones were written three times** (42 instead of 14) on the first page load. Fixed so it happens only once, with unique indexes.
- **ND-4421 was seeded at an odd time** (e.g. 15:11). It is now seeded on the hour.

## Checked end to end (24 Sept) ✅
- Sign in, sign out and wrong password, all 6 roles: 6/6.
- Smoke test: 249 pass. Three patient-code checks now report "skipped" in production mode instead of "failed"; the code flow passed its own check (19/19).
- Typecheck, lint, 590 unit tests and the production build: clean.
- Screen checks: every item except 1, 2 and 6 was re-run on a fresh copy of the demo data, which was deleted afterwards. Items 1, 2 and 6 are covered by the unit tests and the smoke test.

## Still open
- Payments (gateway), then late fees and clinic payments can be paid in the app.
- When a late fee is collected (item 13).
- Back buttons (item 12): two screen checks need patient feedback in the data; the demo seed has none.


---

## 18. The patient chooses a physician and a time for a call, before the drip

**Asked:** "date for appointment selected by patient: select doctor, then a slot for the consultation, then a slot for the drip; admin and doctor assign the nurse."
**Decided (25 Sept):**
- the call is a phone call;
- it is needed only when an approval is needed (first time, retake, or approval expired);
- the doctor and the super admin set the doctor's hours;
- the doctor picks the nurse on approval, with automatic assignment as the fallback;
- all scenarios as listed in chat (#1–41), with the recommended answers.

**Patient**
- **Book a session**, while waiting for an approval, now has two steps:
  - **Step 1, a call with a physician:** choose the doctor (their specialisation, call length, next free time), then a time from that doctor's free call times over the next 7 days. The app asks for a phone number if the account has none.
  - **Step 2, the drip:** held from **2 hours after the call**. Earlier times show "before call".
- **Home** shows the call ("Dr. Sarah Menon will call you on +91… at Sat 26 Sept, 10:30"), with **Move** and **Cancel**.
  - Moving the call later than 2 hours before the held drip asks for a new drip time too, and saves both together.
  - Cancelling keeps the held drip, which waits for a new call.
  - With no call booked, Home shows **"Book your call with a physician"**, with the reason if the last one was missed or cancelled.
- Already approved (within 90 days): no call. Drips are booked directly, as before.

**Doctor**
- **Availability** (new): working hours per weekday (several windows a day), call length (10 / 15 / 20 / 30 min) and days off.
- **Calls** (new, with today's count in the menu):
  - sections: Needs attention (overdue, or outside the hours now) · Today · Coming up · Marked in the last day;
  - each call shows the time, the patient, their number (tap to call), the held drip, and a link to their answers;
  - **Called** / **No answer** can be pressed from 15 minutes before the call.
- **Approvals queue:** "Your patients" (booked a call with you) first, then "No call booked yet", then "With other physicians", each showing the call time.
- The review deadline now starts when the call ends, not when the quiz was sent. A call booked for tomorrow no longer shows as "66h overdue".
- **Review page:**
  - a card shows "You call +91… at Fri 25 Sept, 17:45" and the held drip;
  - approving a different drip than the one held offers **"Switch the held session to …"**.
- Deciding closes the call, even if it was not marked.

**Super admin / admin**
- **Doctor calls** (new):
  - every call, overdue first;
  - the super admin can **Hand over** a call to another doctor (for leave), and the patient and both doctors are told;
  - a table of every doctor's hours, with **Edit** for the super admin.
- The ops admin sees the list, but cannot hand over or edit hours.
- A doctor with booked calls cannot be deactivated until the calls are handed over.

**Rules the server enforces**
- No double booking: one booked call per doctor per time, and one open call per patient, enforced by the database too.
- Calls only inside the doctor's hours, not on days off, and at least 1 hour ahead.
- A held drip must be at least 2 hours after the call. A patient waiting for approval must book the call first.
- Only the doctor on the call (or the super admin) marks it, and not before its time.
- Two unanswered calls release the held drip, and the patient is told.
- A held drip whose time passes without approval is released when a screen that shows it is opened, and the patient is told. The app has no background timer yet.
- Approving after a held drip's time has passed releases it, and the patient picks a new time.
- Moving a held drip keeps it at least 2 hours after the call.
- Everything goes in the audit trail: `call.book`, `call.move`, `call.cancel`, `call.done`, `call.no_answer`, `call.handover`, `hours.update`, `booking.hold_lapsed`.

**Also changed**
- The wording that promised "usually within two hours": the approval message, the results page, the Home timeline, the FAQ ("Who reads my health quiz?"), and the Home figure "2 hr typical review time", which is now "15 min · phone call with your physician".
- **Fixed on the way:** the time picker reloaded its times on every screen update when a page passed it a new function each time. It now reloads only when what it asks for changes.
- **Demo seed:**
  - Dr. Menon takes calls Mon–Sat 10:00–13:00 and 17:00–19:00 (15 min); Dr. Rao takes them Mon–Fri 09:00–12:00 and 16:00–18:00 (20 min);
  - V. Iyer and Riya have calls with Dr. Menon on the next working day, and V. Iyer's held drip is that afternoon;
  - A. Bhatt has no call, so the demo shows "Book your call".

**Not built:** a consultation fee, video calls, and SMS or scheduled reminders. Bells are in-app only, and there is no background timer.

| # | Test | Result |
|---|---|---|
| 18.1 | Unit tests: call times per window and length, days off, 7-day window, taken / too soon / day off, overlapping lengths, the server's refusals, drip 2 h after the call ("before call"), overdue, clashes with new hours, hours validation | ✅ 15 new, 605 pass |
| 18.2 | Typecheck, lint, production build | ✅ clean |
| 18.3 | Smoke test (fresh scratch data): the 7 new call checks (doctors offered, no second call, drip too close refused, not marked early, ops admin cannot hand over, a doctor cannot edit another's hours, hours shorter than a call refused) | ✅ 254 pass, 0 fail |
| 18.4 | A. Bhatt: Home "Book your call" → Book step 1 lists both doctors with next free time → call booked (CL-5003) → step 2 unlocks → drip held 2 h+ after the call → Dr. Menon gets a bell → no sideways scroll at 390 px | ✅ |
| 18.5 | Dr. Menon: Calls lists Iyer, Riya and Bhatt with "Mark from …"; Approvals shows "Your patients" with call times; a day off on the call day lists the calls "On your day off" without cancelling them; removing it clears the list | ✅ |
| 18.6 | V. Iyer: Home call card; moving the call to 17:00 asks for a new drip time; both moved together (call 17:00, drip 2 h+ after) | ✅ |
| 18.7 | Super admin: Doctor calls board, hand-over to Dr. Rao, Iyer told; Dr. Rao cannot be deactivated with a booked call | ✅ |
| 18.8 | No answer: Riya's Home says "We could not reach you … Pick a new time"; two unanswered calls release Iyer's held drip, with the reason | ✅ |
| 18.9 | Dr. Menon decides on Bhatt: call card on the review page; recommending another drip offers "Switch the held session to Hydrate Plus"; approved with changes, so the held session is switched and a nurse assigned; the call closed as "Decided: modified"; the patient told | ✅ |
| 18.10 | Ops admin sees the board without hand-over or hours editing; a held drip whose time passed unapproved is released when Home opens, and the patient told | ✅ |
| 18.11 | Approvals queue after the fix: "None breaching yet", deadlines from the call's end | ✅ |

All testing ran on a separate copy of the demo data, which was deleted afterwards. Your database was not used.

**To use it on your database:** run `npm run seed` for the demo doctors' hours and calls, or have each doctor set their hours on **Availability**. Until a doctor has hours, patients are not offered them, and a patient waiting for approval sees "No physician is taking calls this week".


**18, follow-up (25 Sept): our own Time and Date pickers, not the browser's.** The doctor's hours, the days off, a zone's opening and closing times, and the clinic's "Date paid" were using the browser's built-in boxes, which ignore the theme and look different in every browser. Now:
- **New TimePicker**, the companion to the existing DatePicker. It works the same way:
  - the field shows **"5:00 PM"**, and the panel has **Hour · Minute · AM/PM** columns in our colours, with arrow-key control;
  - typing works: "17:00", "5pm", "5:30 pm", "1730" and "9.15";
  - earliest and latest limits, and a minute step (15 for doctors' hours, 30 for zones);
  - the value is always stored 24-hour ("17:00");
  - on phones, the phone's own time wheel under our field.
- **DatePicker** is now used for "Add a day off" (no past days) and the clinic's "Date paid" (no future days). It gained a hidden label for screen readers, for fields with no visible label.
- No built-in date or time boxes are left in the app.
- On a phone, each "from–to" pair of hours stays on one line, with Remove underneath.

| # | Test | Result |
|---|---|---|
| 18.12 | Unit tests: "5:00 PM" wording, typed times (5pm, 5:30 pm, 1730, 930, 12 am), refusing non-times (24:00, 13 pm, 10:75) | ✅ 4 new, 609 pass |
| 18.13 | Doctor's hours: no built-in boxes on desktop; Monday reads 10:00 AM–1:00 PM; the panel shows 12 hours, minutes 00/15/30/45, AM chosen; choosing 9 then 30 gives 9:30 AM; "until" cannot go before "from"; typing "10:30 am", "1230" and "5:30pm" works; nonsense puts the last good time back | ✅ |
| 18.14 | Saved as 24-hour: Mon 09:30–13:00, Tue 10:30–12:30 and 17:30–19:00. Overlapping hours still cannot be saved | ✅ |
| 18.15 | Day off and "Date paid" open our calendar (future days greyed for Date paid); a zone's Closes offers minutes 00/30 | ✅ |
| 18.16 | Phone (touch): the phone's time wheel under our field, showing "9:30 AM"; no sideways scroll at 390 px | ✅ |
| 18.17 | Typecheck, lint, production build | ✅ clean |


**18, follow-up (25 Sept): picker panels open where they fit.** Near the bottom of the window the calendar opened downward and was cut off (reported on Availability → Days off).
- The Date and Time panels now open **above** the field when there isn't room below, open **below** otherwise, and shift left near the right edge. They are measured before they appear, so they never flash in the wrong place first.
- The panel is placed against the field itself, not the whole block (label and error included).
- **Fixed:** opening the time panel centred the chosen hour with `scrollIntoView`, which could scroll the whole page. It now scrolls only the column.
- This applies everywhere these pickers are used: Availability, Service zones, the clinic's "Date paid", the audit filters, stock expiry, profile and treatment plans.

| # | Test | Result |
|---|---|---|
| 18.18 | Day off at the bottom of the window: the calendar opens above the field, fully on screen, without scrolling the page | ✅ |
| 18.19 | Saturday's last time field at the bottom: opens above; the chosen hour (7) is visible in its column; the page did not move | ✅ |
| 18.20 | Monday's time field near the top: opens below | ✅ |
| 18.21 | Typecheck, lint, production build, 609 unit tests | ✅ clean |


**18, follow-up (25 Sept): the chosen time or date stays readable on hover.** Hovering the chosen hour, minute, AM/PM or day turned its background pale but left the text white, so it disappeared. This affected both pickers, and the calendar had it before this work too. The chosen option now keeps its dark fill and goes one shade darker on hover. Every other option is dark text on the pale hover.

| # | Test | Result |
|---|---|---|
| 18.22 | Under a real mouse: the chosen hour, minute, AM and day all stay white on dark (contrast 6.4:1); another minute is dark on pale (17.6:1) | ✅ |


**18, follow-up (25 Sept): the date picker, checked end to end.** Reported: in January, pressing "previous" showed "December" with the year still 2026. The calendar really was on December 2025, but the Year list for "Add a day off" only offered 2026 onwards, so it showed 2026. The whole month was greyed because it was in the past.

Fixed, with six more problems found by checking the whole calendar:
- **The Year list always contains the year on screen and the chosen year.** This fixes the report, and also a date of birth older than 100 years.
- **Previous and Next are off when that month has no day that can be picked.** For example, no going back past today for a day off, and no going forward past today for "Date paid".
- **Months with no day to pick are greyed in the Month list.** Choosing a year keeps the same month, or moves to the first month that has a day to pick.
- **After changing month with the buttons or the lists, a day can still be reached with the Tab key.** Before, no day in the grid could be reached.
- **Arrow keys and PageUp/PageDown stop at the first or last allowed day**, instead of wandering into greyed months.
- **An empty field opens on today, kept inside the allowed dates**, so it never opens on a fully greyed month.
- **Deleting the text of a field that must hold a date (like "Date paid") puts the date back**, instead of leaving it empty.

| # | Test | Result |
|---|---|---|
| 18.23 | Unit tests: months with a day to pick, keeping a date inside the limits, the Year list (reported case, 1920, no duplicates), January back to December of the year before | ✅ 4 new, 613 pass |
| 18.24 | "Add a day off" (from today): Previous off; Jan–Aug greyed; list starts 2026; Next goes to October and a day is reachable with Tab; picking 2027 keeps October; **January 2027 → Previous → December 2026**; arrow keys stop at today; PageUp stays in September | ✅ 11 checks |
| 18.25 | "Date paid" (up to today): Next off; Oct–Dec greyed; **January 2026 → Previous → December 2025, the Year reading 2025**; a future date and 30-02-2026 refused; 15-08-2026 taken; emptying the box puts the date back | ✅ 8 checks |
| 18.26 | Audit filter (no limits): 05-01-1920 taken; opens on January 1920; both buttons on; Previous → December 1919 | ✅ 4 checks |
| 18.27 | Typecheck, lint, production build | ✅ clean |


**18, follow-up (25 Sept): the pickers stay open while you work in them.** Reported: on this month or the next, pressing Previous closed the calendar. Previous now switches itself off at the first allowed month. When a focused button is switched off, the browser drops the focus, and the picker read that as "focus left", so it closed. Clicking an empty part of the panel, or a greyed time, closed it the same way.
- A picker now closes only when the focus moves to something **outside** it; clicking outside still closes it.
- A button that switches itself off hands the focus to the month list first, so the keyboard is never stranded.
- **Escape** closes the panel from anywhere, including the month and year lists and after clicking an empty part of the panel.
- Applies to both the date and the time picker, everywhere they are used.

| # | Test | Result |
|---|---|---|
| 18.28 | Real mouse clicks on "Add a day off": Next to October, then Previous back to September, and **it stays open**; focus goes to the month list; clicking the switched-off Previous, the weekday row, or a greyed day: still open; Escape from the Year list closes it; a click outside closes it; tabbing out closes it | ✅ 10 checks |
| 18.29 | Time panel: clicking a greyed option (AM) or a column heading keeps it open; Escape closes it | ✅ 4 checks |
| 18.30 | The date picker checks from 18.24–18.26 again | ✅ 23 pass |


**18, follow-up (25 Sept): clearing a date.** Any date that may be empty has **Clear** at the bottom left of the calendar, or you can delete the text and press Tab. "Add a day off" can now be cleared too; nothing is saved until **Add day off** is pressed. "Date paid" still cannot be cleared, because a payment needs a date; pick a different one to change it. A time is never cleared on its own; **Remove** deletes the whole window.


## 19. Time format setting, and India time everywhere

**Asked (25 Sept):** make the 12-hour clock the default, let the super admin switch the whole app to 24-hour, and use India time everywhere so a server deployed later (usually set to UTC) does not shift times.

- **Admin → Settings (super admin only): Time format.** Choose **12-hour (default)**, e.g. "5:00 PM", or **24-hour**, e.g. "17:00". Both options show a preview. It changes every screen for every role: the site, the patient and nurse apps, every console, notifications, and the time pickers. The change is recorded in the audit trail. Ops admins and physicians do not see the page, and the API refuses them (403).
- **Only how times are written changes.** Sessions, calls, doctor hours and zone hours are stored exactly as before, so switching the format never moves anything.
- **In 24-hour mode the time picker shows hours 00–23 and has no AM/PM column.** Typing still accepts both styles: "9:30 am" becomes 09:30.
- **India time (IST) everywhere.** Every date and time is written in India time, whatever the server or a patient's phone is set to. The server's own clock is also set to India time when it starts (`APP_TIME_ZONE`, default Asia/Kolkata). This keeps "today's sessions", "this month" and midnight on Bengaluru's day. Before, a UTC server would have shown every time 5½ hours early, and a 00:30 session would have counted as the previous day. The seed script uses India time too.
- **Also fixed:** the doctor's Calls board showed only the weekday ("Fri") under each call. It now shows the date too ("Sat, 26 Sept").

| # | Test | Result |
|---|---|---|
| 19.1 | Unit tests: 12- and 24-hour times, midnight and noon, stored "HH:MM" times, times inside a sentence (a booking number or a date is left alone), the India calendar day after 18:30 UTC, all run with the machine set to UTC | ✅ 8 new, 621 pass |
| 19.2 | Live, with the server's clock forced to UTC: a session at 00:30 IST is on today's nurse route, and one at 00:30 IST tomorrow is not; the seed put the 10:00 session at 10:00 IST | ✅ |
| 19.3 | 12-hour (default): nurse route "10:00 AM – 10:58 AM"; calls board "10:30 AM" and hours "10:00 AM–1:00 PM"; hours editor "10:00 AM"; time panel has Hour, Minute and AM/PM; patient's call "11:00 AM"; public Zones "7:00 AM – 8:00 PM" | ✅ 11 checks |
| 19.4 | Ops admin: no Settings in the menu, the page redirects, the API returns 403; physician API 403 | ✅ 5 checks |
| 19.5 | Super admin switches to 24-hour: saved, audit row 12h → 24h; nurse route "10:00 – 10:58"; calls "10:00–13:00"; time panel hours 00–23 with no AM/PM column; "9:30 am" typed becomes 09:30; patient "11:00"; Zones in 24-hour; switched back to 12-hour; "36h" refused (422) | ✅ 20 checks |
| 19.6 | Settings page spacing, measured: card padding 24, 20 above the choices, 12 between them, 16 to the note, 24 to Save; at 390px the choices stack full width with no sideways scroll | ✅ |
| 19.7 | Typecheck, lint, production build | ✅ clean |


**18, follow-up (28 Sept): one held drip per patient, and no overlapping sessions.** Found while testing: V. Iyer cancelled his call, booked a new one, and the booking page let him hold a **second** drip. He ended up with two drips at 10:00 AM on the same day. The server never checked the patient's own sessions.
- **A patient waiting for approval can hold only one drip.** A second one is refused: "You already have ND-4421 (Myers' Revive) held for Tue, 29 Sept, 4:00 PM. It is confirmed when your physician approves — move it from Home if the time does not suit."
- **A patient's sessions can never overlap**, whether booking or moving (including a drip moved together with a call). The message names the session already at that time: "You already have ND-4422 … on 29 Sept, 7:00 AM–7:45 AM. Pick a time that does not overlap it." Sessions back to back are fine.
- **The booking page shows the drip already held** ("Step 2 · Your drip: Myers' Revive is held for …") with **Go to Home**, instead of offering another one.
- **A new call has to end 2 hours before a drip still held.** Otherwise it is refused, with the latest time allowed: "Pick a call by Tue, 29 Sept, 1:45 PM, or move the drip from Home first."
- Existing duplicates are not removed automatically. In a dev database, run `npm run seed`, or cancel one from Home.

| # | Test | Result |
|---|---|---|
| 18.31 | Unit tests: same time, overlap from either side, a longer session covering it, back to back allowed, 45 minutes when no length is recorded, the message in 12- and 24-hour | ✅ 5 new, 626 pass |
| 18.32 | Live, V. Iyer: booking page shows ND-4421 held and no picker; a second held drip refused (409), also at the same time; still one held drip; after cancelling his call the page says "It waits for your call"; a call at 5:00 PM refused (drip at 4:00 PM), a call at 12:45 PM taken | ✅ 11 checks |
| 18.33 | Live, S. Krishnan (approved): a second session at the same time refused, and one starting 30 minutes in; one 3 hours later taken; moving it onto the first refused; moving it to a clear time works | ✅ 6 checks |
| 18.34 | Card spacing measured at 390px: 20 padding, 24 below the call card, 8 / 8 / 16 inside, no sideways scroll | ✅ |
| 18.35 | Typecheck, lint, Prettier, production build | ✅ clean |


## 20. "Most popular" drives the home page, and a drip that is not Live is offered nowhere

**Asked (28 Sept):** make "Most popular" dynamic instead of a fixed list, and when a drip is not Live, show it nowhere.

- **The home page's "Most popular" row now shows the drips ticked "Most popular" in the Drip builder**, up to 4 (one row). Before, it was a fixed list of four written in the code, and the tick only added a badge on the Drips page. With nothing ticked, the row is left out. The tick now reads "Most popular — on the home page (first 4)". The seed ticks the same four as before (Myers' Revive, Immune Shield, Glow Protocol, Hydrate Plus).
- **A drip that is not Live can no longer be chosen anywhere new.** It was already hidden from the site, booking and the order forms. Three gaps are closed:
  - a clinic order sent straight to the server was accepted;
  - a new treatment plan could prescribe it;
  - the doctor's review screen still listed it as suggested.

  Sessions, orders and plans made before it was switched off are left alone and keep working, and a plan that already had it can still be edited. The Drip builder still lists it, so it can be switched back on.
- **Fixed on the way:** saving only part of a drip (one tick, for example) was refused for drips shorter than 45 minutes, like Jetlag Reset and Hydrate Plus, with "The longer end of the range must be more than the shorter end". The check compared against a default of 45 minutes instead of the drip's own length. No data was affected.

| # | Test | Result |
|---|---|---|
| 20.1 | Live, on a scratch database: the seed's four show on the home page; tick Jetlag Reset and untick Glow Protocol, and the row follows; seven ticked still shows one row of 4; none ticked leaves the row out and the page still renders | ✅ 7 checks |
| 20.2 | Jetlag Reset switched off: gone from the home row (though ticked), the Drips page, its own page, Pricing, the booking page and the clinic order form; booking it directly refused (404); a clinic order for it refused (409) while one for a Live drip goes through; a new plan with it refused, a plan written before it was retired still edits, adding it to a plan refused; not suggested on the doctor's review; still listed in the Drip builder; switched back on, it returns | ✅ 17 checks |
| 20.3 | Typecheck, lint, Prettier, 626 unit tests, production build | ✅ clean |


**20, follow-up (28 Sept): "Show on the public catalogue" means the website only.** Before, unticking it also hid the drip from the clinic order form, the pharmacy's screens, the doctor's recommend list and the booking page. Yet the quiz could still suggest it and a doctor could still prescribe it.
- **Unticked, the drip is off the website:** Home (including the "Most popular" row), the Drips page, Pricing, About, For clinics, the related drips on other drip pages, and its own page, which no longer opens.
- **Staff still see it:** clinic and admin order forms, stock availability, the doctor's recommend list and treatment plans.
- **A patient can book it only when their physician recommended it.** Their booking page then offers it, and their results page shows it as a card without a link. Anyone else booking it directly is refused: "That drip is booked on your physician's recommendation only."
- **The quiz's automatic suggestions come from website drips only.** A physician can still recommend a hidden one.
- **The Drip builder marks it "Not on the website"** and has no "Public page" button for it.
- **Fixed:** opening a drip in the Drip builder always showed **"Show on the public catalogue"** and **"Needs physician approval"** ticked, whatever was saved. Pressing **Save the recipe** then put a hidden drip back on the website and a no-approval drip back behind approval. The editor now opens with what is saved.

| # | Test | Result |
|---|---|---|
| 20.4 | Unit tests: a website drip can be booked by anyone; a hidden one only when recommended; a drip saved before the setting counts as on the website | ✅ 4 new, 630 pass |
| 20.5 | Live, Glow Protocol hidden (still Live): gone from the home row, the Drips page (8 protocols), its own page, Pricing and the related lists; still offered on the clinic and admin order forms, stock availability and the doctor's review; the clinic can order it | ✅ 11 checks |
| 20.6 | Live, patients: not offered to S. Krishnan and refused if booked directly (403); once his physician recommends it, it is offered and books; his results page shows it without a link | ✅ 5 checks |
| 20.7 | Live, Drip builder: "Not on the website" label and no Public page button; editing Glow Protocol shows the box unticked and saving keeps it hidden; editing Hydrate Plus (no approval) shows "Needs physician approval" unticked and saving keeps it; label 12 px from its neighbours | ✅ 10 checks |
| 20.8 | Typecheck, lint, Prettier, production build | ✅ clean |


## 21. Patient and nurse apps at every screen size, desktop to phone

**Asked (28 Sept):** the patient and nurse apps worked only as a phone screen. On a desktop they were a 560px column in the middle, with the phone's bottom tab bar. They need to work on every screen from desktop to mobile.

Built in two steps, following the widths in the design's responsive proofs (Block 8): **(1)** one frame for all 22 screens, then **(2)** page layouts, screen by screen.

**Step 1 (28 Sept): the frame.**
- **Phone (below 834px):** unchanged, with bottom tabs and the header.
- **Tablet (834–1023px):** a menu button in the header opens the sections in a drawer. It closes with ✕, Escape, a tap outside, or a tap on a link. Focus goes into the drawer and back to the button.
- **Desktop (1024px and up):** a 240px sidebar, as in the doctor and admin consoles, with the sections and, at the bottom, who is signed in and Sign out. The page sits beside it with a larger title.
- The sidebar shows the app's sections on every page, including a session or a report that hides the bottom tabs on a phone. It marks the section the page belongs to.
- Nurse sidebar rows are 56px tall (used standing and gloved); patient rows are 44px.
- The nurse app's "waiting to sync" banner now sits at the top of the page column instead of above the whole screen.

| # | Test | Result |
|---|---|---|
| 21.1 | Live, 5 screens (patient Home, Sessions, a session; nurse Today, a session) at 1440 and 1024: sidebar 240px, no menu button, no bottom tabs, right section marked, no sideways scroll | ✅ 10 checks |
| 21.2 | Same 5 screens at 834: menu button, no sidebar, no bottom tabs, no sideways scroll; the drawer opens with focus on Close and Sessions marked, Escape closes it and returns focus, tapping Reports goes there and closes it | ✅ 8 checks |
| 21.3 | Same 5 screens at 390: as before (bottom tabs where the page had them), no sideways scroll | ✅ 5 checks |
| 21.4 | Typecheck, lint, Prettier, 630 unit tests, production build | ✅ clean |


**21, follow-up (28 Sept): the tablet layout starts at 768px, not 834px.** Reported: at 768px (an iPad held upright) the apps still looked like a stretched phone. The design's proofs start the tablet band at 834px, but most iPads held upright are narrower: iPad mini 744–768, iPad and iPad Air 820. So the menu button and drawer now start at **768px**, and the page there is up to 720px wide (was 640). Below 768px the phone layout, with bottom tabs, is unchanged.

**Also (28 Sept): the address map uses Google's current pin.** The browser console warned that `google.maps.Marker` is deprecated. The address map (the welcome "Where should we come?" step, and Profile → Edit my details) now uses `AdvancedMarkerElement`, which can also be dragged with the keyboard. The script is loaded the way Google recommends (`loading=async`), which removes a second console warning about slower loading. The new pin needs a Map ID: set `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` (Google Cloud → Map Management, free). Until then Google's `DEMO_MAP_ID` is used, which is fine for development. See `.env.example`.

| # | Test | Result |
|---|---|---|
| 21.5 | Patient Home at 767px: bottom tabs, no menu; at 768 and 820: menu button, no bottom tabs, page 720px, no sideways scroll; at 1024: sidebar | ✅ 4 checks |
| 21.6 | Profile → Edit my details at 1440: the map and the new pin load; no "Marker is deprecated" warning, no loading=async warning, no Maps errors in the console; dragging the pin with the mouse moves it and the form shows the new point | ✅ 5 checks |
| 21.7 | Typecheck, lint, Prettier, 630 unit tests, production build | ✅ clean |


**21, follow-up (28 Sept): tablets keep the bottom tabs.** Asked: on a tablet, show the same bottom tabs as on a phone, and only make the content wider. The menu button and drawer are gone. The bands are now:
- **Phone (below 768px):** unchanged, with bottom tabs and a 560px page.
- **Tablet (768–1023px):** the same bottom tabs, spread across the full width; the page uses the full width with 32px margins; no menu button.
- **Desktop (1024px and up):** the sidebar in place of the bottom tabs, as before.

| # | Test | Result |
|---|---|---|
| 21.8 | Patient Home at 390 and 767: phone layout; at 768, 820 and 1023: bottom tabs across the width, page full width with 32px margins, logo in line with the content, no menu button; at 1024 and 1440: sidebar; no sideways scroll anywhere | ✅ 10 checks |
| 21.9 | Nurse at 820: Today has bottom tabs and full width; a session (a task screen) has no tabs, as on a phone | ✅ 2 checks |
| 21.10 | Typecheck, lint, Prettier, 630 unit tests, production build | ✅ clean |


**21, follow-up (28 Sept): the sign-in page on a tablet.** Reported: at 768px the sign-in form was a narrow 420px strip down the middle. On a tablet (768–1023px) the form, and the demo accounts under it in development, are now 560px wide. On a phone it fills the screen as before; on a desktop it stays 420px beside the demo accounts. (The demo accounts half exists only outside production; real users see the form alone.)

| # | Test | Result |
|---|---|---|
| 21.11 | Sign-in form width: 342px at 390, 560px at 768, 420px at 1024 and 1440; no sideways scroll | ✅ |


**21, step 2a (28 Sept): patient pages laid out for tablet and desktop.** Every patient screen now uses the width. Phones are unchanged, including the order of the cards.
- **Home:** two columns from a tablet up. On the left, what happens next: the call, a session to rate, the next session and the approval. On the right, your health: the vitality score and the treatment plan.
- **Sessions:** session cards two across. On a desktop the vitality trend sits beside them and stays in view (only when there is a trend to show).
- **A live session:** the bag, your nurse and baseline vitals on the left; the nurse's progress and notes on the right.
- **Session report:** what was given, vitals and what happened on the left; fees, aftercare, rating and who was responsible on the right.
- **Your vitality (results):** score, lowest markers, suggestions and the physician's decision on the left; all sixteen markers on the right.
- **Treatment plan:** on a desktop the summary stays in view beside the week-by-week schedule.
- **Lab reports:** on a desktop the upload form sits beside the list; reports two across.
- **Profile:** the detail cards two across, and the two buttons side by side. The page keeps a reading width on a desktop, because most of it is a form.
- **Booking:** drips two across from a tablet up. On a desktop the page has two panes: which drip and where on the left; the time, the summary and the button on the right. In the call step the physicians sit beside their free times.
- **Health quiz and the address step:** the column is 720px wide on a tablet or desktop (was 560).

| # | Test | Result |
|---|---|---|
| 21.12 | Live, all 12 patient screens (Home, Sessions, a live session, a report, results, plan, reports, profile, booking with a call, booking approved, quiz, address step) at 390, 768, 1024 and 1440: no sideways scroll, nothing past the edge (on the address step only the map's own tiles, clipped inside the map) | ✅ 48 checks |
| 21.13 | Home and results: on a phone the cards keep their order top to bottom; at 768, 1024 and 1440 they sit in two columns | ✅ 8 checks |
| 21.14 | Typecheck, lint, Prettier, 630 unit tests, production build | ✅ clean |


**21, step 2a follow-up (28 Sept): layouts follow the room the page has, not the screen.** Reported:
- above 1024px the layout did not change, so a 1920px screen had a large empty area;
- at 1024px the report cards were squeezed (file name cut, text broken word by word);
- on a tablet the call's time picker was cramped inside a half-width card;
- the call picker put Saturday and Sunday on a second row;
- the website header broke its links onto two lines at 1024px.

Changes:
- **Columns follow the width of the page area, not the screen** (the desktop sidebar takes 240px, so a 1024px desktop leaves less room than a 1000px tablet). Home, Your vitality, a live session and a session report use:
  - one full-width column below 896px of page, so pickers and forms inside a card have room;
  - two columns from 896px, each at least ~430px;
  - three from 1152px.

  On a phone the cards keep their order.
- **Wide pages use up to 1600px** (was 1200).
- **Card lists fit as many columns as there is room for**: sessions (~340px each), lab reports (~320px), drips on the booking page (~240px), profile cards (~300px). No card is squeezed: at 1024px lab reports show two per row under the upload button; at 1920px, three beside it.
- **Profile uses the full width.** The cards run up to four across. The edit form keeps a reading width (880px), and "Edit my details" is no longer a full-width bar.
- **Booking, Lab reports, Treatment plan and Sessions** put their side panes beside the content only when the page has room for both.
- **The call and session pickers show every day on one row.** A week of calls is 7 columns; on a narrow phone "20 free" wraps under the date instead.
- **The website header** shows its page links from 1280px. Below that the menu button carries them, and no label breaks onto two lines.

| # | Test | Result |
|---|---|---|
| 21.15 | Home and Your vitality at 425, 768, 1024, 1000 (tablet), 1280, 1440, 1536 and 1920: 1, 1, 1, 2, 2, 2, 3, 3 columns as the page width allows; no sideways scroll | ✅ 16 checks |
| 21.16 | Lab reports and Profile at the same widths: no report card under 300px, no profile card under 290px, Edit button not stretched from a tablet up | ✅ 16 checks |
| 21.17 | The call picker ("Move it") at 375, 425 and 768: all 7 days on one row, no sideways scroll | ✅ 3 checks |
| 21.18 | Website header at 1024 (menu button, nothing on two lines) and 1280 (page links) | ✅ 2 checks |
| 21.19 | All 12 patient screens at 390, 768, 1024 and 1440: no sideways scroll (on the address step only the map's own clipped tiles reach past the edge); on a phone Home and results keep their order | ✅ |
| 21.20 | Typecheck, lint, Prettier, 630 unit tests, production build | ✅ clean |


**21, follow-up (28 Sept): no empty strip on big screens; the day picker uses a phone's width.** Reported: on a big screen the right side stayed empty (Profile, Lab reports), and on a phone the "Move" day picker was cramped.
- **Pages use the whole width beside the sidebar** at any size (the 1600px cap is gone).
- **Lists stretch their cards to fill each row** (lab reports, sessions, drips when booking): two reports share the row instead of leaving empty slots on the right.
- **Profile fills whole rows.** Its six cards go one, two or three across, never a half-empty row. Retake the health quiz, Lab reports and Sign out form one row as wide as the cards (stacked on a phone, as before). Lab reports is now an outlined button like the others.
- **The Move and Reschedule panels** are a section under a rule on a phone, not a box inside the card. The days and times get the card's full width: at 425px a day is 46px wide (was ~40px). From 640px they are boxed as before. Days sit 4px apart when there are seven.

| # | Test | Result |
|---|---|---|
| 21.21 | Profile, Lab reports and Home at 390, 768, 1024, 1440, 1920 and 2560: cards reach the right edge of the page (0px gap), no sideways scroll | ✅ 18 checks |
| 21.22 | Profile: one card per row on a phone with Sign out below; full rows of 2 (768–1440) and 3 (1920, 2560); the button row exactly as wide as the cards | ✅ 6 checks |
| 21.23 | Move panel at 375, 390, 425: seven days on one row, no inner box, the row as wide as the card; at 425 only Sunday's "no calls" wraps; at 768 boxed, every label on one line | ✅ 5 of 6 checks. The one flag is that "no calls" wrap at 425, accepted: the next step would take labels below 11px |
| 21.24 | Typecheck, lint, Prettier, 630 unit tests, production build | ✅ clean |


**21, follow-up (28 Sept): a week of days in two rows on a phone.** Reported: seven days squeezed into one row looked shrunk on a phone. A week of call days now wraps into rows of four (four and three) whenever the picker is under 448px wide. Each day is 67–80px wide and every "20 free" fits on one line. From 448px (a tablet up) all seven share one row, and the drip picker's five days always share one row.

| # | Test | Result |
|---|---|---|
| 21.25 | Move panel at 375, 390, 425: two rows, 4 + 3, days 67 / 71 / 80px wide, no label on two lines; at 768 one row of 7; no sideways scroll | ✅ 7 checks |
| 21.26 | Booking at 390: the drip picker's 5 days on one row | ✅ |
| 21.27 | Typecheck, lint, Prettier, 630 unit tests, production build | ✅ clean |


**21, follow-up (28 Sept): Edit my details at full width; lab report cards line up.** Reported: the Profile edit screen stayed 880px wide on a big screen; the lab report cards' buttons did not sit at the bottom; on a big screen the upload sat beside the cards instead of above them.
- **Edit my details uses the whole width.** When the page has room (896px or more), you and your emergency contact sit on the left and the address with its map on the right. What a nurse reads aloud runs across the bottom, its boxes two to a row. Save sits at the right at its own width. Narrower, it is one column in the order it always had.
- **Lab report cards:** Open and Remove sit at the bottom of every card, and the middle takes the spare height, so the buttons line up across a row.
- **Lab reports:** the upload takes the whole row at every width, with the reports below it.

| # | Test | Result |
|---|---|---|
| 21.28 | Edit my details at 390, 768, 1024, 1440, 1920: reaches the right edge (0px gap); at 1440 and 1920 the address sits beside you, reads-aloud spans the bottom and Save is 240px; narrower, one column in the original order; no sideways scroll | ✅ 5 checks |
| 21.29 | Lab reports at the same widths: upload as wide as the page, reports below it; every Open button 21px from its card's bottom; level across a row from 768 up (on a phone the cards stack) | ✅ |
| 21.30 | Typecheck, lint, Prettier, 630 unit tests, production build | ✅ clean |


**21, follow-up (28 Sept): nothing spills out of a card on the public site.** Reported: on the Drips page at 768px the "Ingredients" label ran past the edge of the card, and "45–60 min" broke onto two lines.
- **Drip cards:** the price, duration, volume and ingredients sit two by two in a narrow card (a phone, or a tablet's two columns), and in one row once the card is 448px wide. Their values never break.
- **For clinics enquiry form:** on a phone, City takes its own row, with Rooms and Sessions/mo side by side under it. Three to a row had pushed "est." out of the card. From 640px the three share a row as before.
- A sweep of every public page and the patient pages found nothing else.

| # | Test | Result |
|---|---|---|
| 21.31 | 12 public pages (Home, Drips, a drip, Pricing, How it works, Safety, Zones, For clinics, About, FAQs, Consult, Terms) and 7 patient pages, at 390, 768, 1024, 1280 and 1920: no text or control drawn outside its card, no sideways scroll | ✅ 95 page-widths, 0 problems (a comparison table that scrolls inside its own box on a phone is deliberate and not counted) |
| 21.32 | Typecheck, lint, Prettier, 630 unit tests, production build | ✅ clean |


**21, step 2 (29 Sept): the nurse app, phone to big screen.** Every nurse screen now uses the width it has. A tablet keeps the bottom tabs with a wider page. From 1024px the side menu appears. Cards sit side by side and fill the row, with no empty band on the right.
- **Today, Schedule, Kit:** sessions, kit items and plans are cards, as many across as fit (about 340px each). Cards in a row share one height, and their buttons sit level at the bottom. Once a card is wide, its button keeps a button's width instead of stretching. On the Schedule, time and status share a card's top line, so the name and address get the full width.
- **Me:** Registration, Your record and What patients said sit two, then three, to a row, at one height.
- **A plan:** the summary stays in view on the left, with the weeks beside it two to a row (one on a phone). Weeks in a row end level, with the physician's note at the foot. The patient's plan page uses the same weeks.
- **A session:** once the page has room, On my way, progress and the prescription sit in a column that stays in view, with the checklist beside it. Buttons in the checklist keep a button's width.
- **Vitals:** three fields to a row on a tablet, all six in one row on a big screen.
- **Consent:** what was agreed to and the risks sit on the left; the agreement and the capture on the right.
- **Kit check:** the items are cards, three across on a laptop, ticked in the same order.
- **Prescription:** the components are cards, as many across as fit, with How it must run and Approved by in a column beside them. The locked screen asking for the patient's code is one focused card, never a bar across the page.
- **Infusion running:** the bag and what is in it sit on the left and observations on the right. On a big screen the bag, the components and the observations sit three across.
- **Adverse event:** what the patient reports, then what you did, on the left; severity, then anything else, on the right. On a phone the order is unchanged.
- **Session report:** the record's cards flow into two, then three, columns.
- Buttons are full width on a phone and a button's width from a tablet up.

| # | Test | Result |
|---|---|---|
| 21.33 | All 16 nurse screens (Today, Schedule, Kit, Me, a plan, a session live and not started, Vitals, Consent, Kit check, Prescription open and locked, Infusion running, Adverse event, Report finished and in progress) at 390, 768, 1024, 1440, 1920 and 2560: no sideways scroll, nothing outside its card, cards reach the right edge, cards in a row at one height with buttons level, no button stretched across a tablet or wider page | ✅ 96 page-widths, 0 problems |
| 21.34 | Every screen above checked by eye at each width; the adverse form keeps its phone order (reported, severity, what you did, anything else) | ✅ |
| 21.35 | Patient plan page (shares the weeks) at 390, 768, 1440, 1920; public and patient sweep re-run | ✅ 0 problems |
| 21.36 | Typecheck, lint, Prettier, 630 unit tests, production build | ✅ clean |


**Quiz (29 Sept): a way out part-way.** Reported: while answering the health quiz there was no way to stop and go back, except the browser's own Back, which some patients will not think of.
- **Close (✕) at the top right of every question.** With nothing answered yet it goes straight to Home.
- **With answers given, it asks first:** "Leave the quiz?" The patient is told their answers so far will not be kept. Keep answering is the first, highlighted choice; Leave the quiz goes to Home. Escape or a tap outside keeps them on the quiz. On a retake it also says their earlier answers stay as they are; the first time, that they can take the quiz from Home whenever they are ready.
- Unfinished answers are not saved anywhere (as agreed), so leaving by the browser's Back or by closing the tab still loses them.

| # | Test | Result |
|---|---|---|
| 22.1 | At 390, 768, 1440: ✕ is 44 × 44 and does not make the header taller; nothing answered → Home at once; one answer → the question appears with Keep answering focused; Escape and Keep answering stay with the answer kept; Leave the quiz → Home; retake and first-time wording | ✅ 30 checks |
| 22.2 | Typecheck, lint, Prettier, 630 unit tests, production build | ✅ clean |


## 23. The public website, redesigned

**23 (29 Sept): a modern, photographic public site.** Asked: the website worked but looked basic; make it feel premium and professional, keeping the brand colours, the content and everything that works.
- **Every public page** has the new look: Home, Drips, each drip, How it works, Pricing, Safety, Zones, For clinics, About, FAQs, Ask a clinician and the three legal pages. Same teal, same fonts, same copy. Nothing was removed.
- **Photography:** 24 licensed photographs (Unsplash, free for commercial use) beside our own hero photo: drips, nurses, physicians, a pharmacist, vitals at home, Bengaluru. Each of the nine drips has its own picture, and a drip added later gets its category's. Credits are in public/images/README.md; a file can be swapped for the company's own photography without code changes.
- **Home:** a larger hero with the photo and the three promises floating on it; a slow credentials strip; How it works as a four-step scroll story with the quiz and the report drawn as screens; drip and goal cards with photographs; reviews as a carousel; a closing panel with a photograph.
- **Drip pages:** the photograph with the actives listed on it, then the price card, formula, session, reviews and FAQs. On a phone a small booking bar appears once the price card has scrolled away.
- **Header and footer:** the header stays at the top with a soft blur. Below 1280px the menu opens as a full-screen sheet. New footer.
- **Motion:** sections rise in as they arrive, figures count up, cards ease on hover. All of it is off for anyone whose device asks for reduced motion.
- **Fixed on the way:** a drip page's "Free cancellation up to 4 hrs" now reads the hours set on the Billing page. A drip with too few reviews of its own now says "What people say after a session" instead of implying the reviews are about it, and the "3 reviews for this drip" line is the site-wide rating instead. The five stars shown under every drip card were removed: they were the same for every drip, whatever the reviews said. Doses no longer break across two lines. The hero photo's description now matches the photo.
- **Unchanged:** booking, the quiz, sign-in, the forms, live availability, the late-change rule and every figure shown.

| # | Test | Result |
|---|---|---|
| 23.1 | 12 public pages at 390, 768, 1024, 1440 and 1920 (Home also at 2560): no sideways scroll, nothing outside its card, every photograph loads | ✅ |
| 23.2 | Sections reveal as they scroll in and none stays hidden; figures count up; carousel arrows move the reviews; an FAQ opens; the header takes its hairline after scrolling; a drip card eases and turns its arrow on hover | ✅ |
| 23.3 | Phone menu: opens full screen, focus moves into it, Escape closes it and returns focus, tapping a link goes there and closes it | ✅ |
| 23.4 | Drip page booking bar at 390 and 768: hidden at the top, shown past the price card (also after jumping to the formula), hidden at the closing panel and again back at the top | ✅ |
| 23.5 | Reduced motion: nothing hidden, figures shown as they are, the strip still | ✅ |
| 23.6 | Header with the longest labels (a long patient name and "Answer your physician") at 1024, 1280 and 1440: fits, no sideways scroll | ✅ |
| 23.7 | Typecheck, lint, Prettier, 630 unit tests, production build | ✅ clean |


## 24. The public website, faster

**24 (29 Sept): pages open faster and scroll smoothly.** Reported: because of the images and animations, pages took a long time to load and scrolling felt laggy. Asked: fix it without removing the images or the animations.
- **Nothing was removed.** Every photograph and every animation is still there. They are now built so that none of them makes anyone wait, and none of them costs frames while scrolling.
- **The first screen appears at once.** The headline, the text and the photograph start their entrance the moment the page is drawn, instead of waiting for the page's scripts and then for the loader.
- **Opening loader:** still once per visit, now 0.8 s instead of 1.5 s, and on screen from the very first moment. Before, the page showed half-drawn and then the loader covered it.
- **Drip pages:** the loader used to play after every drip click for about a second, even when the page was already there. It now appears only if a drip page is genuinely slow to arrive, and leaves the moment it does. On a normal connection it does not appear.
- **Smooth scrolling:** the frosted-glass blur behind the header, the floating cards, the labels on drip photos and the phone booking bar was being redrawn on every frame of a scroll. These are now solid white, which looks the same on our white pages. Photographs fade in instead of opening with a clipping effect. The credentials strip and the floating cards pause while they are off screen. The slow photo drift (parallax) runs on computers only.
- **Lighter images:** our own hero photograph was a 2 MB file; the site now uses a 184 KB copy of the same picture. Photographs are stored no larger than any page shows them, so each size a screen asks for is prepared faster, and high-resolution laptops and phones get a smaller file than before.
- **Fewer database reads:** a page reads the site's editable text once instead of twice, and a drip page fetches its data in two steps instead of three.
- **Fixed on the way:** the figures under the Home, Zones and For clinics headlines now line up along the top, whatever their labels wrap to.

| # | Test | Result |
|---|---|---|
| 24.1 | Time until the headline is readable, first visit, development build, before → after: Home 4.6 s → 2.8 s on a computer and 5.2 s → 4.4 s on a slow phone; a drip page 7.2 s → 4.7 s and 4.8 s → 4.4 s. Production build: 1.5 s on a computer and 2.5 s on a slow phone for a returning visitor | ✅ |
| 24.2 | Scrolling Home on a slowed-down phone: graphics work while scrolling 70 → 7 ms, longest graphics stall 17 → 1 ms; production build scrolls at 60 frames a second with no dropped frames | ✅ |
| 24.3 | Opening loader: on screen from the first frame of a first visit and gone within about a second (production); never shown to a returning visitor, a search engine or anyone without JavaScript; reduced motion gets the short version | ✅ |
| 24.4 | Drip click: a page that arrives quickly (143 ms, production) shows no loader; a slow one (1.9 s, development) shows it until the page arrives, then it leaves | ✅ |
| 24.5 | 12 public pages at 390, 768, 1024, 1440 and 1920: no sideways scroll, checked by eye | ✅ |
| 24.6 | Header hairline after scrolling; strip and floating cards pause off screen and resume; everything on screen arrives while reading down the page; phone booking bar, also after a jump; figures count up only when nobody has seen them yet; no console errors | ✅ 20 checks |
| 24.7 | Typecheck, lint, Prettier, 630 unit tests, production build | ✅ clean |


## 25. Smoother loading, a new header and footer, livelier buttons

**25 (29 Sept): the website, second pass.** Reported: scrolling while a page was still loading looked laggy; the header and footer looked the same as before (and the big word at the bottom of the footer looked cut off); buttons and their hover effects were plain; reviews should move by themselves and stop on hover; the "4.9" figure on Home sat lower than the other two; the drip filter chips on a phone had no left margin; the black hover fill left a white edge; and the big moving text band was not wanted. Asked for more auto-moving rows where they suit, such as Most booked, and better photos only where they are clearly better.
- **Loading and scrolling:** nothing is hidden while a page loads any more. Sections still rise in, but just before they reach the screen, and almost at once when someone scrolls fast, so no blank space trails the scroll. Photos show a lighter placeholder while they load.
- **Opening animation:** shows on a visitor's first page of the day, not on every new tab or reload. The page holds still while it plays.
- **Header:** a floating white bar with rounded ends. A soft highlight follows the pointer across the menu, and the current page sits in a teal pill. **Drips** opens a menu: the goals, with how many drips each has, and the most booked drips with photo, price and time. It opens on hover, or with the arrow beside it for keyboard and touch. Large screens show a Bengaluru label, and a signed-in visitor sees their initial. On a small phone, a signed-in patient's long button labels stay on one line.
- **Footer:** a "Now serving" strip of the zones, moving slowly. The large NutriDrip word is now whole and as wide as the page, with the legal line underneath, so it no longer looks cut off.
- **Buttons (website only):** rounded. Main buttons get a sheen, lift slightly and slide an arrow on hover. The others fill with colour from the bottom, now edge to edge. Every button gives slightly when pressed. The staff apps keep their buttons as they were.
- **Reviews:** move on by themselves every 5.5 seconds and stop while the pointer is over them or a keyboard is in them. There is a pause button. They never move for anyone whose device asks for reduced motion.
- **Most booked (Home):** now a slow, endless row of the drip cards that stops under the pointer or a finger. The large moving text band was removed.
- **Photos:** the Zones page opens on Bengaluru at dusk from above, with the metro line running through the neighbourhoods (Unsplash, Priyansh Patidar). A new Energy photo was tried and the original kept, by preference. The For clinics photo stayed, as no free photo was clearly better.
- **Fixed:** the drip filter chips on a phone line up with the page again. The Home figures line up along the top (a build made before item 24 still showed "4.9" lower). Reviewers' names on phone review cards are no longer cut short. The review row on a computer no longer shows a sliver of the previous card. On Drips, the first photo loads first.

| # | Test | Result |
|---|---|---|
| 25.1 | Reload a page and scroll at once (production build, slowed-down phone and computer): time with something still invisible on screen, before → after: Home 0.9 s → 0 on a computer and 0.5 s → 0 on a phone; a drip page 2.2 s → 0.2 s and 1.3 s → 0; worst hidden area a full screen → a 165 px strip | ✅ |
| 25.2 | Header with the longest labels (a long first name and "Answer your physician") at 360, 390, 768, 1024, 1280, 1440 and 1536: nothing overlaps or spills out, no sideways scroll | ✅ |
| 25.3 | Drips menu: opens on hover and with Enter, Tab moves into it, Escape closes it and returns focus, it closes when focus leaves, after choosing a goal, and stays closed after Back | ✅ |
| 25.4 | Reviews: move on their own, hold under the pointer, resume after; Most booked row moves, holds under the pointer, each drip reachable and read once; reduced motion: nothing moves, each card shown once | ✅ |
| 25.5 | Opening animation: page held still under it, marked as seen when it starts, not replayed on reload or in a new tab the same day, shown again the next day; pages without it are never held | ✅ 8 checks |
| 25.6 | Drip chips at 360, 390 and 430 start at the page margin and still scroll sideways; hovered black button solid to the edge | ✅ |
| 25.7 | 12 public pages at 390, 768, 1024, 1440 and 1920: no sideways scroll, checked by eye; behaviour suite; no console errors | ✅ 21 checks |
| 25.8 | Typecheck, lint, Prettier, 630 unit tests, production build | ✅ clean |


## 26. The opening animation plays on every device

**26 (29 Sept): the opening animation froze at 0%.** Reported: opened by the computer's network address (http://192.168.1.7:3000, as a phone or another computer would), the opening animation showed "Preparing 0%" and did not move.
- **Cause:** the count only started once the page's code had downloaded and started. On a slower device or connection that took longer than the 3-second safety limit, so the animation was taken away before it ever moved. The same happened on a device set to reduce motion.
- **Now:** the count, the bag emptying and the name filling all run from the very first moment the page appears, and finish on time however slowly the rest of the page loads. It still shows once a day, holds the page still while it plays, and is never replayed by a reload.
- **Reduced motion:** a device set to reduce motion skips the opening animation and shows the page straight away.

| # | Test | Result |
|---|---|---|
| 26.1 | Opened at http://192.168.1.7:3000 and at localhost: counts 0 to 100, fades, page appears (development and production builds) | ✅ |
| 26.2 | With all of the page's code blocked (the slowest possible device): still counts 0 to 100, fades, page appears and scrolls; marked as seen | ✅ |
| 26.3 | Held still while it plays, not replayed on reload or in a new tab the same day, shown again the next day, never on pages without it | ✅ 8 checks |
| 26.4 | Reduced motion: no opening animation, the page from the first frame | ✅ |
| 26.5 | Behaviour suite, typecheck, lint, Prettier, 630 unit tests, production build | ✅ clean |


## 27. No lag while a page loads on a computer

**27 (29 Sept): scrolling lagged until the page had fully loaded.** Reported: on a computer, in the production build too, a page felt laggy and "still loading" after a reload, with sections still filling in while scrolling; screenshots of the whole page showed large empty bands.
- **Cause, found on this office computer's own graphics chip (Intel HD 530):** the fading edges of the moving strips made the graphics chip draw an extra layer on nearly every frame. The moving strips and floating cards ran while the page was still loading, competing with it. Sections also stayed invisible until they faded in, which looked like missing content and showed as blank bands in whole-page screenshots.
- **Now:**
  - **No fading:** nothing on the page ever fades in from invisible. Sections still rise gently into place and photos still settle from a slight zoom, but everything is readable the moment it is on screen.
  - **Moving strips:** they fade at their edges in a way that costs the graphics chip nothing extra. They, the floating cards and the reviews' autoplay wait until the page has finished loading.
  - **Photos:** once a page has loaded, a computer fetches its remaining photos quietly in the background, so scrolled-to photos are already sharp. Phones still load them as they come near.
  - **Fewer requests:** the links in the header, menu, footer and cards no longer ask the server for pages in advance that it could not prepare anyway (96 requests per home-page visit → 61).
- **Unchanged:** every animation, every photo and every page.

| # | Test | Result |
|---|---|---|
| 27.1 | Production build on this computer's graphics chip, reload and scroll straight away at 100% and 150% display scaling: graphics work 1.6 s → 0.8–0.9 s, main thread 2.9 s → 2.0 s; after loading, no frame over 34 ms (worst 21–24 ms); at 150% not one slow frame even while loading | ✅ |
| 27.2 | While scrolling during and after load: time with anything invisible on screen 0.55 s → 0; time with a photo on screen still loading → 0 | ✅ |
| 27.3 | Whole-page screenshot taken part-way down after a reload: every section and photo shown, no blank bands | ✅ |
| 27.4 | Moving strips, floating cards and reviews still while the page loads, running afterwards; strips fade with no mask; behaviour, intro and layout suites; no console errors | ✅ 42 checks |
| 27.5 | Typecheck, lint, Prettier, 630 unit tests, production build | ✅ clean |


## 28. Drip filters keep your place

**28 (29 Sept): changing a goal tab on Drips jumped to the top.** Reported: on the Drips page, choosing a goal tab (Energy, Immunity…) scrolled the page back up.
- **Fixed:** the goal tabs and "Clear the search" now keep the page where it is and only re-sort the drips below, as the search box already did. Each filter still has its own address that can be shared.

| # | Test | Result |
|---|---|---|
| 28.1 | Typecheck, lint, Prettier | ✅ clean (not browser-checked: a one-attribute change) |


## 29. Online payment with Razorpay

**29 (30 Sept): every payment in the app, through Razorpay.** Asked for: Razorpay for every payment, with proper error and status handling, smooth animation, automatic refunds when something fails, a modern payment screen, and every case tested end to end. Decided with the client: patients pay when booking (refunded automatically if the session does not go ahead); clinics pay orders online with bank transfer kept as a fallback; clinics on credit pay invoices online.

Online payment switches on when the Razorpay keys are added (`.env.example` lists them and the dashboard steps). Until then the app works exactly as before.

- **Added — patients pay to book.** "Pay ₹9,200 and book" (or "…and hold this slot" while the physician decides). Paid securely through Razorpay: UPI, cards, net banking, wallets.
- **Added — automatic refunds.** Refunded in full when a physician declines, the team or a clinic cancels, vitals stop the session, a held slot lapses, or the patient cancels in good time. A late cancellation refunds everything except the late fee. A physician switching to a cheaper drip refunds the difference; a dearer one asks the patient to pay the balance.
- **Added — a late move is paid for first:** "Pay ₹500 and move".
- **Added — if it cannot be done, it goes straight back.** Paid for a slot that was taken in the minute it took to pay: refunded in full, and the patient is told why. The same for a payment for the wrong amount, or a second payment on something already paid.
- **Added — the payment screen.** A sheet that shows each step while the payment is confirmed, then a tick with the amount and a receipt (receipt number, how it was paid, when). A refund shows where the money has got to: started, with your bank, in your account. Closing Razorpay, a declined card, or a slow bank each say clearly what happened and that no money was lost.
- **Added — clinics.** "Pay online" on an unpaid order (received at once, nobody has to check it), with the transfer form kept under "Paid by bank transfer, UPI or cheque instead?". An order paid online and then cancelled is refunded automatically. Invoices show Paid, Due or Overdue, with Pay on each unpaid one; the team can record a transfer against an invoice.
- **Added — Admin → Payments.** Every payment and refund, with the month's figures (collected, refunded, refunds on their way). A refund Razorpay refuses shows under *Needs attention* (and in the menu badge) with a retry. Refunds can be made by hand, with a reason and a confirmation.
- **Added — receipts** on every session report: each payment, its receipt number, and every refund with its bank reference once processed.
- **Changed:** the Terms and Pricing pages now say you pay when you book and are refunded in full if the session does not go ahead (they said "charged on completion").
- **Fixed:** an open Move or Cancel panel on Sessions now takes the card's full width instead of squeezing into the row of buttons.

| # | Test | Result |
|---|---|---|
| 29.1 | Unit tests: signatures, the Razorpay client, the money rules (every refund case), invoice due dates | ✅ 36 new, 666 in all |
| 29.2 | End to end against a stand-in for Razorpay: pay to book; late and in-time cancel; late move; the team cancelling; slot taken while paying; decline; clinic order and invoice; hand refund; closed browser; failed then good attempt; manual capture; refused refund and retry; lost refund answer (never sent twice); paid twice; wrong amount; cheaper and dearer drip switch; lapsed hold; vitals stand-down; older fees; transfer and online together; webhooks | ✅ 113 checks, 0 failed |
| 29.3 | The screens in a browser at 390 and 1440: pay button, confirming, paid with receipt, refunded, closed, declined, sessions, report, clinic order, invoice, billing, admin ledger and refund | ✅ 43 checks, 0 failed |
| 29.4 | Keys not set: bookings work without paying, no pay buttons, the webhook refuses | ✅ 7 checks |
| 29.5 | Typecheck, lint, Prettier, production build | ✅ clean |
| 29.6 | With real Razorpay test keys, the real Checkout window and a real webhook | ⏳ waiting on the keys |

**29, follow-up (30 Sept): Razorpay's capture settings.** Set in the Razorpay dashboard: automatic capture within 12 minutes, late approvals refunded automatically, normal refund speed.
- **Fixed:** when Razorpay captures a payment a moment before the app does, the booking is confirmed at once instead of after a second check.
- **Fixed:** a payment the bank approves too late, which Razorpay returns without taking, is recorded as a failed attempt (never as paid) and the patient can simply pay again.

| # | Test | Result |
|---|---|---|
| 29.7 | Razorpay's capture wins the race; approved too late and returned — against the stand-in | ✅ 4 checks; full suite 117, 0 failed |


## 30. Payments and bookings that happen at the same moment

**30 (30 Sept): every way money moves, checked for two things happening at once.** Asked for: close the gap where two patients paying for the last free nurse at the same moment could both be booked; go through every part of payments with care, because it is patients' money; and check the physician call booking the same way.

- **Fixed — the last free nurse.** Booking a slot, moving a session, a physician's approval and assigning a nurse now happen one at a time, each checked again at that moment. Two payments for the last free nurse at the same moment: one is booked, the other is refunded in full straight away and told the time was taken. A nurse is never given two sessions at once.
- **Fixed — a cancellation during an approval.** A patient cancelling at the moment the physician approves can no longer bring a refunded session back to life. Two physicians deciding the same answers at once can no longer both win: the second is told it was already reviewed.
- **Fixed — a refund could be lost.** A cancellation arriving while another refund on the same payment was going through (a refund by hand, or the bank's confirmation) could have its refund dropped. It now waits its turn and is sent. Anything left half-done, for example if the server stopped at that moment, is sent the next time the patient or the team opens their payments.
- **Fixed — goodwill turned into a "balance to pay".** A refund by hand on a session still to come made it look underpaid, and the patient was asked to pay the goodwill back. Goodwill now never creates a balance, and it is not taken out of a later refund for a cheaper drip.
- **Fixed — a failed refund sent again by hand** is recorded as the refund it replaces, so it can never be sent a third time.
- **Fixed — the price changes while the patient pays.** A session costs what the patient agreed to at checkout; before, they could be shown a surprise balance.
- **Fixed — a balance paid as the session is cancelled** comes back in full with everything else, and the message says so.
- **Fixed — a declined session** can no longer be cancelled afterwards, which would have added a late fee to a session that was never going ahead.
- **Fixed — clinic orders.** A bank transfer recorded while an online payment for the same order is landing can no longer leave both in place: the online payment is refunded. An order cancelled while its online payment is landing is refunded in full.
- **Added — "Session needs a nurse".** When a time is free but every nurse free then already has 6 open sessions (the per-nurse limit), the paid booking stands and the team is told to assign a nurse. Before, it was left without one and nobody was told.
- **Changed — instant refunds** (optional: `RAZORPAY_REFUND_SPEED=optimum`, charged per refund by Razorpay). When Razorpay sends a refund instantly, messages and the refund tracker say "usually within minutes"; a normal refund still says 5–7 working days.
- **Checked — physician calls.** Five patients booking the same call at once: exactly one gets it. One patient booking two calls at once: one. The database already enforced this; nothing needed to change. Moving a call together with its held drip now happens in one step, so neither moves without the other.

| # | Test | Result |
|---|---|---|
| 30.1 | Against the stand-in for Razorpay, every race fired truly at once: two patients for the last nurse; five patients for two nurses; one patient paying twice; a paid booking against a move; two late-move fees; cancel against approval (5 rounds, both orders seen); two physicians at once; a cancellation during a hand refund; browser and webhook together; two captures from every side; a balance against a cancel; a transfer against an online payment; an order cancel against its payment; five patients booking one call; goodwill; a refund retried by hand; a half-done refund picked up; declined then cancelled; the price changing while paying | ✅ 74 checks, 0 failed |
| 30.2 | The lock itself, on the app's own code: 20 simultaneous read-then-write updates with none lost; a refusal rolls back; a stale status write is refused | ✅ 9 checks |
| 30.3 | The earlier payment suite, and online payment switched off | ✅ 117 and 7 checks, 0 failed |
| 30.4 | Unit tests (8 new: goodwill, refund timing), typecheck, lint, Prettier, production build | ✅ 674 tests, clean |


## 31. A nurse's day, and two layout fixes

**31 (30 Sept): six sessions per nurse per day, set by the super admin.** Decided with the client: the limit is per day, not in total; the booking screen and nurse assignment follow the same rule; the super admin can change the number; an admin can still assign a nurse by hand.

- **Changed — the nurse limit is per day.** A nurse takes at most 6 sessions on one day (sessions already finished that day count too). Before, the limit was 6 unfinished sessions in total across all days, and the booking screen ignored it, so a patient could pay for a time and get no nurse.
- **Changed — the booking screen follows the same rule.** Once every nurse who could go has a full day, that day's times show as taken, and a payment for one is refused before any money is asked for: "Every nurse who could come that day is already fully booked. Pick another day." A drip held for the physician keeps its place in the day, so approving it always finds its nurse.
- **Added — Admin → Settings → Nurse workload** (super admin): sessions per nurse per day, 1 to 12, starting at 6. The change is recorded in the audit trail; sessions already booked are never moved or called off by it.
- **Changed — the physician's nurse list** counts the day of the session being approved: "2 of 6 that day", "full that day".
- **Fixed — moving a session onto a day its nurse is already full** hands it to a nurse who is free, and tells the first nurse why, instead of giving her one more than the limit.
- **Unchanged:** an admin can assign any nurse by hand, over the limit if they choose.
- **Fixed — the order page's header (Admin → Orders → an order).** "Raised …", the buttons and the bell sit on one line again. The "Not paid yet…" note under the buttons made the header tall and left the date and bell floating; it now shows when you hover over Confirm, and the payment card below still explains it in full. An error from Confirm or Cancel gets a line of its own under the header.
- **Fixed — dropdowns open where they fit.** A choice list near the bottom of the screen now opens upwards, as the date and time pickers do, is never taller than the room it has, and opens with the chosen option in view. (The nurse workload setting, the physician's nurse choice and the quiz rule builder.)

| # | Test | Result |
|---|---|---|
| 31.1 | Unit tests: a full day, finished sessions counting, a place kept for a held drip, the new refusal, India dates across midnight, the physician's list, the limit's range | ✅ 8 new, 682 in all |
| 31.2 | Against the stand-in for Razorpay: the setting (range, who may change it, audit, the page); a full day no longer offered and not payable; two patients paying at once for a day's last place (one booked, one refunded); a held drip keeping its place and getting its nurse on approval; the physician's list; moving onto a full day and within one; a move handed to a nurse who is not full; assigning by hand; the order page's header | ✅ 42 checks, 0 failed |
| 31.3 | The payment race suite (now 0 sessions waiting for a nurse), the earlier payment suite, and online payment switched off | ✅ 74, 117 and 7 checks, 0 failed |
| 31.4 | Typecheck, lint, Prettier, production build | ✅ clean (the dropdown's placement: same rule as the date and time pickers; not browser-checked) |

## 32. Reviews a little quicker, and counting figures

**32 (1 Oct): asked for while reviewing the website video.**

- **Changed — the reviews row moves on every 4.5 seconds** (was 5.5), on the home page and on each drip's page. As before, it holds still while the pointer is over it or it has keyboard focus, the pause button stops it, and with reduced motion it never moves on its own.
- **Fixed — a counting figure could show a negative number for an instant.** The figures that count up as they come into view (the home page's 4.9 rating, 15 min and 14 zones, and others like them) and the amount in the payment sheet timed themselves against two different clocks; when the clocks disagreed, the count started below zero. They now use one.

| # | Test | Result |
|---|---|---|
| 32.1 | Typecheck, lint, Prettier, production build | ✅ clean |
| 32.2 | In a browser (the website video's recording): the reviews row moving on by itself twice, 4.5 s apart; Next to the end and Previous back to the start; the home page's figures counting up to 4.9, 15 min and 14 with no negative values | ✅ |
| 32.3 | The payment sheet's amount: the same one-line change | not browser-checked |

## 33. Patients no longer see partner clinics

**33 (2 Oct): "For patient login, the clinic admin is also opened — restrict it, don't show the patient about the clinic."** A patient could never open the clinic console (it sends them to sign-in and records the refusal). What they did see was on Book a session: a "A partner clinic" choice under Where, then a list of every clinic by name.

- **Changed — Book a session offers My home, My office and A hotel only.** The partner-clinic choice and the list of clinic names are gone.
- **Changed — the server refuses a patient booking at a clinic**, so it cannot be made by calling the API directly either: "Sessions are given at your home, office or hotel."
- **Changed — the website no longer says patients can go to a partner clinic** (How it works, and two FAQs; the clinic FAQ now asks about an office or a hotel).
- **Changed — demo data:** V. Iyer's held session (ND-4421) is at home instead of at the clinic. Takes effect on the next `npm run seed`.
- **Unchanged:** sessions already booked at a clinic stay as they are, and can still be moved. Clinics keep their own console.
- **Fixed — the payment success screen** no longer repeats "Paid." under the amount; the title, amount and receipt already say it.

| # | Test | Result |
|---|---|---|
| 33.1 | Typecheck, lint, Prettier, unit tests | ✅ clean, 682 passed |
| 33.2 | The success screen without "Paid.": seen during payment testing (Test 2) | ✅ |
| 33.3 | Book a session without the clinic choice, and the server's refusal | not browser-checked yet |

## 34. Fixes from the payment testing round

**34 (2 Oct): found while testing payments step by step against Razorpay in test mode.**

- **Fixed — a refund could be refused as "Duplicate receipt found".** Razorpay will not take the same refund reference twice on one account, and ours was only the receipt number and refund count (RCPT-2026-0003-R1). Receipt numbers start again after a reseed — or if a database is ever restored — so every refund after that would fail. The reference now also carries the payment's own id, which never repeats.
- **Fixed — a declined session stayed under Upcoming,** with Move and Cancel, on the patient's Sessions page. It now goes to Your history, as it already did on Home.
- **Fixed — a refund that had not gone through yet showed as "Refund on its way ₹0".** It now says "Your refund is being arranged", as the patient's notification does, until the team sends it.
- **Changed — session cards line up.** In a row of cards, what sits under the title (Move / Cancel, and Paid / Refunded) is at the foot of each card, so the money rows are level and no card ends in an empty band.
- **Fixed — our logo on Razorpay's pages.** Checkout and the bank page it opens showed a broken image (or an "N"): the logo was a link Razorpay's https pages could not load from a non-public site. It is now sent with the payment itself.
- **Fixed — Admin → Payments, after Check.** A long Check result stretched the last column across the page; it now wraps in a column the width of the Refund form.

| # | Test | Result |
|---|---|---|
| 34.1 | Unit tests: the refund reference is new when a receipt number repeats, counts refunds, and fits Razorpay's 40 characters | ✅ 2 new, 684 in all |
| 34.2 | Typecheck, lint, Prettier | ✅ clean |
| 34.3 | Payment tests 1–6 against Razorpay test mode (pay, fail and pay again, close the window, cancel in time and late, two payments for a day's last place, a physician's switch and the balance) | ✅ passed |
| 34.4 | Test 7 (a physician's decline and its refund) found the duplicate-receipt refusal; the retry with the fix | to be confirmed |

## 35. An empty column takes no room

**35 (2 Oct): "In a grid, if one column is empty the UI looks bad — many places have 3 columns."**

- **Fixed — the three-column pages no longer leave a blank third.** Home, Session report, the live session and Results lay out in up to three columns on a wide screen, and a column with nothing to show kept its full width — for example the left of Home for a patient the physician declined, or the middle of the report for a session that never started. A column with nothing in it now takes no room, and the others share the width. One shared layout (`components/layout/columns.ts`), so all four pages follow it.

| # | Test | Result |
|---|---|---|
| 35.1 | Typecheck, lint, Prettier; the new rules compiled by Tailwind and checked | ✅ |
| 35.2 | Test 7 (item 34.4) confirmed: after the fix, the declined session's ₹9,200 refund went through and shows as processed in Razorpay | ✅ |
| 35.3 | The four pages at every width in a browser | not checked yet |

## 36. A paid order no longer reads "on credit"

**36 (2 Oct): found in payment Test 8 (a clinic pays an order online; the team cancels it).** The money was right — paid, then refunded in full — but two screens said otherwise.

- **Fixed — an order paid before it was confirmed said "On credit — invoice, 30 days" once it was cancelled,** on both the clinic's and the team's order page, and the team's page did not show the refund at all. An order with no recorded terms (one placed before the pay-first rule, like the demo orders) was only treated as pay-first while it was a draft. One that carries a payment is now always pay-first.
- **Fixed — Check on Admin → Payments said "Paid." for a payment since refunded.** It now says where the payment stands: "Up to date with Razorpay: ₹27,200 paid; all of it refunded." (or the part refunded, or what the bank has not confirmed yet).

| # | Test | Result |
|---|---|---|
| 36.1 | Unit tests: a paid order stays pay-first when confirmed or cancelled; Check's summary for paid, part-refunded, refunded, refund pending, failed refund, unpaid | ✅ 4 new, 687 in all |
| 36.2 | Typecheck, lint, Prettier | ✅ clean |
| 36.3 | Payment Test 8: order paid online, cancelled, ₹27,200 refunded and processed in Razorpay | ✅ |

## 37. Payment testing — all ten tests passed

**37 (2 Oct): every payment path, run by hand against Razorpay in test mode, with the webhook delivered through ngrok.** Bugs found along the way are items 34–36.

| # | Test | Result |
|---|---|---|
| 37.1 | Book and pay; Razorpay captured; webhook 200 | ✅ |
| 37.2 | A failed payment, then paying again (a fresh attempt after 30 minutes) | ✅ |
| 37.3 | Closing the payment window: nothing charged, the time still free | ✅ |
| 37.4 | Cancelling in good time (full refund) and late (₹500 kept, the rest refunded) | ✅ |
| 37.5 | Two payments at once for a day's last place: one booked, the other refunded in full | ✅ |
| 37.6 | The physician switches a held drip to a dearer one; the patient pays the ₹2,600 balance | ✅ |
| 37.7 | The physician declines: the held session refunded in full (after fix 34) | ✅ |
| 37.8 | A clinic pays an order online; the team cancels it; ₹27,200 refunded (labels fixed in 36) | ✅ |
| 37.9 | A clinic pays an invoice on credit online; Billing shows it paid | ✅ |
| 37.10 | The team's Check, and a ₹100 goodwill refund that leaves the session paid, not owing | ✅ |

## 38. The invoice's pay button lines up

**38 (2 Oct):**

- **Changed — on an unpaid invoice, "Pay online" sits flush right** beside the amount due, with "Secured by Razorpay" and the ways to pay right-aligned under it. It used to float in the middle of the card. On a phone it stacks under the amount, left-aligned, as before.

| # | Test | Result |
|---|---|---|
| 38.1 | Typecheck, lint, Prettier | ✅ clean (not browser-checked) |
