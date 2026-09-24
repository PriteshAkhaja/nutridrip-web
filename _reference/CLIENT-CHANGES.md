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
