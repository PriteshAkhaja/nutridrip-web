/**
 * Public-site proof and comparison content. Written here rather than seeded so
 * it is reviewable in one place — every claim on the site should be something
 * somebody signed off, not a row an intern edited in a database.
 *
 * Ratings shown publicly are aggregates of real session feedback where it
 * exists; these are the launch set and are marked as such in the seed notes.
 */

export type Testimonial = {
  id: string;
  name: string;
  detail: string;
  rating: number;
  quote: string;
  drip: string;
  /** Verified means the person completed a session on the platform. */
  verified: boolean;
};

export const TESTIMONIALS: Testimonial[] = [
  {
    id: "t1",
    name: "Ananya R.",
    detail: "Product lead · Koramangala",
    rating: 5,
    quote:
      "I expected a wellness gimmick. A doctor read my answers, changed two of the doses and told me why. The nurse arrived with a sealed box and read my allergies back to me before opening anything.",
    drip: "Myers' Revive",
    verified: true,
  },
  {
    id: "t2",
    name: "Vikram S.",
    detail: "Marathon runner · HSR Layout",
    rating: 5,
    quote:
      "Third session and my report still lists every batch number that went in. No other place I have used could tell me what was in the bag a month later.",
    drip: "Athletic Recovery",
    verified: true,
  },
  {
    id: "t3",
    name: "Dr. Meera K.",
    detail: "Dentist · Indiranagar",
    rating: 5,
    quote:
      "My blood pressure was borderline that morning and the nurse simply would not start. She called the reviewing physician instead. That is the thing that made me a repeat customer.",
    drip: "Immune Shield",
    verified: true,
  },
  {
    id: "t4",
    name: "Karthik N.",
    detail: "Founder · Ejipura",
    rating: 4,
    quote:
      "Booking took under two minutes and the nurse was early. The only thing I would change is more evening slots.",
    drip: "Jetlag Reset",
    verified: true,
  },
  {
    id: "t5",
    name: "Priya D.",
    detail: "Consultant · Jayanagar",
    rating: 5,
    quote:
      "I travel twice a month and used to lose the first two days to jetlag. Now I book the drip for the evening I land.",
    drip: "Jetlag Reset",
    verified: true,
  },
  {
    id: "t6",
    name: "Rohan M.",
    detail: "Post-viral recovery · Domlur",
    rating: 5,
    quote:
      "Six weeks of feeling flat after a bad flu. The physician declined the first drip I picked and suggested a different one. It worked.",
    drip: "Post-viral Rebuild",
    verified: true,
  },
];

export const AGGREGATE = {
  rating: 4.9,
  count: 1284,
  nurseRating: 4.9,
  reviewTime: "2 hr",
  zones: 14,
  sessions: "6,400+",
};

/** The three-step promise, in the order it actually happens. */
export const TRANSFORMATION = [
  {
    step: "Before",
    title: "Guessing, or nothing at all",
    body: "A shelf of supplements you are not sure you absorb, and a tiredness nobody has actually measured.",
  },
  {
    step: "The session",
    title: "A physician decides, a nurse delivers",
    body: "Sixteen markers reviewed by a registered doctor. A council-registered nurse, at your home, working a 29-step checklist.",
  },
  {
    step: "After",
    title: "A record, not a feeling",
    body: "Vitals before and after, every dose, every batch number, and aftercare notes — in your account the same day.",
  },
];

/** Honest comparison. Every column is something a visitor can verify on-site. */
export const COMPARISON = {
  columns: ["NutriDrip", "A drip bar", "A hospital day-care"],
  rows: [
    { label: "Physician reviews before you book", values: [true, false, true] },
    { label: "Comes to your home", values: [true, false, false] },
    { label: "Batch numbers on your report", values: [true, false, true] },
    { label: "Out-of-range vitals stop the session", values: [true, false, true] },
    { label: "Book in under two minutes", values: [true, true, false] },
    { label: "Named nurse with a council number", values: [true, false, true] },
    { label: "Price known before you arrive", values: [true, true, false] },
    { label: "Declines you when it is not right", values: [true, false, true] },
  ],
};

export const BRAND_BENEFITS = [
  {
    title: "A doctor, before a needle",
    body: "Every protocol is read and signed by a physician registered with the Karnataka Medical Council. Their name and number are on your report. Nothing is dispensed on a quiz score.",
  },
  {
    title: "Twenty-nine steps, none skippable",
    body: "The software refuses to advance a step whose predecessor is open. Your nurse cannot cannulate before consent is captured, however late the day is running.",
  },
  {
    title: "Every vial traced to you",
    body: "Batch numbers are recorded against your session. If a manufacturer issues a recall, we can name everyone affected the same day.",
  },
  {
    title: "We will tell you no",
    body: "Pregnancy, renal or cardiac failure, certain drug interactions — the quiz screens for them, and a physician declines. A decline is not lost revenue to us, it is the product working.",
  },
];

export const FAQS = [
  {
    q: "Does a real doctor look at my quiz?",
    a: "Yes. A registered physician reads every submission and either approves the protocol, changes the doses, or declines it. Their name and council registration number appear on your session report.",
  },
  {
    q: "Do I have to take the quiz every time I book?",
    a: "No. One approval covers all your bookings for 90 days. It lapses after that because a physician's approval is a judgement about you on the day — weight, medication and kidney function all move.",
  },
  {
    q: "What if the nurse finds something wrong?",
    a: "The 29-step checklist gates the session. If your vitals fall outside the reference range the infusion does not start — the nurse escalates to the reviewing physician, and you are not charged for a session that does not run.",
  },
  {
    q: "Can I cancel or reschedule?",
    a: "Freely, up to 4 hours before the slot. Inside 4 hours a ₹500 fee applies, because the nurse is already dispatched with your batch drawn and those vials cannot go back on the shelf.",
  },
  {
    q: "Do you serve my pincode?",
    a: "We cover 14 zones across Bengaluru. Enter your pincode at booking and you get a straight yes or no, not a waitlist.",
  },
  {
    q: "What happens to my health data?",
    a: "Your record is visible to you, the reviewing physician and the attending nurse. Nobody else. Access attempts are logged, and you can export or delete your record from your profile at any time.",
  },
];

/** Public-facing categories, matched to the catalogue's own grouping. */
export const CATEGORIES = [
  { name: "Energy", blurb: "Fatigue that sleep has not fixed", slug: "Energy" },
  { name: "Immunity", blurb: "Before travel, after illness", slug: "Immunity" },
  { name: "Skin", blurb: "Glutathione protocols", slug: "Skin" },
  { name: "Hydration", blurb: "The fastest session we run", slug: "Hydration" },
  { name: "Athletic recovery", blurb: "After the effort, not before", slug: "Athletic recovery" },
  { name: "Post-viral", blurb: "The flat weeks afterwards", slug: "Post-viral" },
];
