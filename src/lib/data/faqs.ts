import { APPROVAL_VALID_DAYS } from "@/lib/clinical/validity";
import { LATE_CANCEL_FEE_INR, LATE_CHANGE_HOURS, SLOTS } from "@/lib/clinical/slots";
import { ZONES } from "@/lib/zones";
import { CHECKLIST_STEPS } from "@/lib/clinical/checklist";

/**
 * The questions on /faqs.
 *
 * Every answer here describes something the app actually does today. That is
 * a rule, not a nicety: an FAQ is read as a promise, and this one is read by
 * people deciding whether to let a stranger put a needle in their arm. So the
 * numbers come from the constants that enforce them — change the 90-day
 * approval or the ₹500 fee and this page follows — and nothing is claimed that
 * has no code behind it. There is no payment gateway, so there is no answer
 * about refunds. There is no export button, so there is no answer promising
 * one.
 *
 * Pure, and imports nothing that touches the database, so the client-side
 * search and the tests can both use it.
 */

export type Faq = { q: string; a: string };
export type FaqCategory = { id: string; label: string; blurb: string; items: Faq[] };

const limitedZones = ZONES.filter((z) => z.status === "limited").map((z) => z.name);

/** "Whitefield, Sarjapur Road and Hebbal" */
function listOf(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    id: "before",
    label: "Before you book",
    blurb: "The quiz, the physician, and who this is not for.",
    items: [
      {
        q: "Who reads my health quiz?",
        a: "A registered physician reads every submission. They approve the protocol, change the doses, ask you for more information, or decline it. Their name and council registration number appear on your session report. Nothing is dispensed on a quiz score alone.",
      },
      {
        q: "How long does an approval last?",
        a: `${APPROVAL_VALID_DAYS} days. After that you answer the quiz again, because an approval is a physician's judgement about you on the day — weight, medication and kidney function all move. Within the ${APPROVAL_VALID_DAYS} days it covers every booking you make.`,
      },
      {
        q: "Who is IV therapy not suitable for?",
        a: "Pregnancy, established renal failure, congestive cardiac failure, known anaphylaxis to a component, and G6PD deficiency for any high-dose vitamin C protocol are all reasons we decline. Several other conditions make a physician want more information first. The quiz screens for all of them, and the full list is on the Safety page.",
      },
      {
        q: "What if the physician declines me?",
        a: "A decline is not a refusal of care. It usually means there is a better route for you, and the physician says which. If they need something from you first — a recent lab result, for example — the quiz comes back to you as needing more information rather than as a no.",
      },
      {
        q: "Do you serve my pincode?",
        a: `We cover ${ZONES.length} zones across Bengaluru. Enter your pincode at booking and you get a straight yes or no, not a waitlist. ${
          limitedZones.length
            ? `${listOf(limitedZones)} run shorter service hours; the Zones page lists every window.`
            : "The Zones page lists every window."
        }`,
      },
    ],
  },
  {
    id: "booking",
    label: "Booking and changes",
    blurb: "Slots, cancelling, and the four-hour line.",
    items: [
      {
        q: "How do I book a session?",
        a: `Take the quiz and wait for the physician's approval. Then choose your drip, a date and a time slot — the day's slots run from ${SLOTS[0]} to ${SLOTS[SLOTS.length - 1]} — and whether the nurse comes to your home or you go to a partner clinic.`,
      },
      {
        q: "Can I cancel or reschedule?",
        a: `Freely, up to ${LATE_CHANGE_HOURS} hours before the slot. Inside ${LATE_CHANGE_HOURS} hours a session cannot be moved, because the nurse is already dispatched with your batch drawn. You can still cancel, and a ₹${LATE_CANCEL_FEE_INR.toLocaleString("en-IN")} late fee applies.`,
      },
      {
        q: "Can I have the session at a clinic instead of at home?",
        a: "Yes. When you book you choose either your home or one of our partner clinics. It is the same physician-approved protocol and the same checklist either way.",
      },
    ],
  },
  {
    id: "day",
    label: "On the day",
    blurb: "What happens from the nurse setting off to the report.",
    items: [
      {
        q: "How will I know the nurse is coming?",
        a: "When your nurse sets off they press On my way, and your session screen shows Nurse on the way with an estimate of the minutes. You also get a notification.",
      },
      {
        q: "Why does my nurse ask me for a code?",
        a: "Your prescription — the drugs and doses — is your medical record, and a nurse who holds a booking number is not, by that alone, a nurse standing in your front room. So a six-digit code is sent to your own phone, and your nurse opens the prescription only once you read it out. It proves they are with you.",
      },
      {
        q: "What if I cannot give the code — my phone has died?",
        a: "A flat battery must not stop a nurse treating you, so there are two ways through. Your physician can authorise it, or, if no physician answers, the nurse can proceed under their own name after recording why and how they checked your identity. Either way you are told that it happened, and it is written to an audit log.",
      },
      {
        q: "What do I actually consent to?",
        a: "Your nurse reads the risks aloud, then you sign or confirm with a code. A copy of that exact wording and the doses you were shown is stored with your record at that moment, so what you agreed to can always be shown back to you — even if a protocol is edited later.",
      },
      {
        q: "What happens if my vitals are out of range?",
        a: "Baseline vitals are taken before any cannulation. A reading outside its reference range stops the infusion before it starts and escalates to the physician who approved your protocol. Your nurse cannot override that; only the physician can clear it.",
      },
      {
        q: "What if I feel unwell during the infusion?",
        a: `Your nurse works through a ${CHECKLIST_STEPS.length}-step checklist and logs observations at 10-minute intervals, including anything you mention however minor. Anything you report is filed and reaches your physician immediately, and every nurse carries a sealed anaphylaxis kit that is checked in date before the first session of the day. NutriDrip is not emergency care — in an emergency call 108.`,
      },
      {
        q: "What do I get afterwards?",
        a: "A session report in your account: your vitals, the doses given, the batch number of every vial, the aftercare notes, and the name and registration number of the physician who approved it.",
      },
    ],
  },
  {
    id: "records",
    label: "Your records",
    blurb: "Who can see them, and what is written down.",
    items: [
      {
        q: "Who can see my health record?",
        a: "You, the physician who reviews you and the nurse attending your session use it day to day. Our operations team can also open it where running the service needs that — working the review queue, for example. Whoever it is, every time a clinical record is opened — a chart, a prescription, a lab report, a session — that is written to an audit log with who opened it, when, and what for. Trying to open one you are not entitled to is logged as a refusal.",
      },
      {
        q: "Can I upload my lab reports?",
        a: "Yes, from your account. Your physician can read them when they review you, and you can remove a report you uploaded.",
      },
      {
        q: "How do I ask for my data to be corrected or deleted?",
        a: "Write to the grievance officer — the address is on the Grievance officer page, and it is acknowledged within 48 hours. Deletion removes your account, contact details, quiz answers and uploads. Records of sessions that actually took place are kept for the statutory period, because a batch trace has to name who received a recalled vial.",
      },
    ],
  },
  {
    id: "plans",
    label: "Plans and clinics",
    blurb: "Multi-week courses, and partnering with us.",
    items: [
      {
        q: "What is a treatment plan?",
        a: "A course your physician writes week by week: which protocol on which day, and every component with its dose and route. You can read the whole plan in your app before anything is given, and your physician can change it — you are told when they do.",
      },
      {
        q: "Can my clinic partner with NutriDrip?",
        a: "Yes. Partner clinics order preparations from the pharmacy, see the batch numbers once an order is dispatched, and manage their own sessions in a console of their own. Send an enquiry from the For clinics page and an operations lead will contact you.",
      },
    ],
  },
];

export const FAQ_TOTAL = FAQ_CATEGORIES.reduce((n, c) => n + c.items.length, 0);

/**
 * Narrow the list by a category and a search.
 *
 * Every word in the search has to appear, in the question or the answer, in any
 * order — "cancel fee" finds the cancellation answer even though the words are
 * a sentence apart. Case does not matter. A category that ends up with nothing
 * in it is dropped, so the page never shows a heading over an empty box.
 */
export function filterFaqs(
  categories: FaqCategory[],
  opts: { query?: string; category?: string } = {}
): FaqCategory[] {
  const words = (opts.query ?? "")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  return categories
    .filter((c) => !opts.category || opts.category === "all" || c.id === opts.category)
    .map((c) => ({
      ...c,
      items: words.length
        ? c.items.filter((i) => {
            const text = `${i.q} ${i.a}`.toLowerCase();
            return words.every((w) => text.includes(w));
          })
        : c.items,
    }))
    .filter((c) => c.items.length > 0);
}

/** How many answers survive a filter — for "3 results". */
export function countFaqs(categories: FaqCategory[]): number {
  return categories.reduce((n, c) => n + c.items.length, 0);
}
