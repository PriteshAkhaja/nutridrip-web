import { cache } from "react";
import { connectDB } from "@/lib/db/mongoose";
import { ContentBlock } from "@/lib/models";

/**
 * Editable copy on the public site. Every key has a fallback written here, so
 * the site renders correctly on a fresh database and a deleted row is a
 * revert rather than a blank.
 */
export const CONTENT_DEFAULTS = {
  "home.headline": "IV nutrient therapy, at home, with a doctor in the loop.",
  "home.sub":
    "Answer a 16-point health quiz, get a protocol reviewed by a registered physician, and have a nurse administer it in your own home. No walk-in, no guesswork.",
  "home.cta": "Take the health quiz · 3 min",
  // How long the physician's call takes: the drip page and How it works quote it.
  "home.stat2.value": "15 min",
  "home.stat2.label": "phone call with your physician",
  "home.safety.heading": "Where the safety actually sits",
  "home.contra.body":
    "IV therapy is unsuitable during pregnancy, in renal or cardiac failure, and with certain drug interactions. The quiz screens for these and a physician can decline.",
  // "Why IV and not tablets?" on the home page, in the client's wording.
  "home.why.heading": "Why IV and not tablets?",
  "home.why.lede":
    "A tablet passes through your stomach, gut and liver before what's left reaches your blood. An IV drip goes straight into a vein.",
  "home.why.body":
    "Tablets are enough for many people. A doctor may choose IV when absorption is poor, a test shows a deficiency, or nutrients are needed quickly.",
  // The IV vs Tablets page, in the client's wording. Three lines are changed to
  // the process NutriDrip runs (marked "ours"); a physician should confirm
  // them (_reference/CLIENT-CHANGES.md). "{duration}" is filled from the drips.
  "ivtabs.heading": "Why IV and not tablets?",
  "ivtabs.lede": "The difference is the route a nutrient takes to reach your blood. Follow one dose each way.",
  "ivtabs.tab.label": "By tablet",
  "ivtabs.tab.1.title": "Swallowed",
  "ivtabs.tab.1.short": "Mouth",
  "ivtabs.tab.1.body": "One dose, taken by mouth.",
  "ivtabs.tab.2.title": "Stomach",
  "ivtabs.tab.2.body":
    "The tablet has to break down and dissolve first. B12 also needs intrinsic factor, made in the stomach.",
  "ivtabs.tab.3.title": "Small intestine",
  "ivtabs.tab.3.short": "Gut",
  "ivtabs.tab.3.body":
    "Nutrients cross the gut wall through transporters that can fill up. Vitamin C, for one, is absorbed less efficiently at higher doses.",
  "ivtabs.tab.4.title": "Liver",
  "ivtabs.tab.4.body":
    "Blood from the gut passes through the liver first. For some substances, part of the dose is processed here (the first-pass effect).",
  "ivtabs.tab.5.title": "Bloodstream",
  "ivtabs.tab.5.short": "Blood",
  "ivtabs.tab.5.body": "What remains reaches your blood. How much varies with the nutrient, the dose and your gut.",
  "ivtabs.iv.label": "By IV drip",
  "ivtabs.iv.1.title": "Into a vein",
  "ivtabs.iv.1.body": "The drip runs into a vein in your arm, over {duration}.",
  "ivtabs.iv.2.title": "Bloodstream",
  "ivtabs.iv.2.body": "The nutrients are in your blood directly. No stomach, gut or liver on the way.",
  "ivtabs.level.full": "Full dose",
  "ivtabs.level.less": "A little less",
  "ivtabs.level.lessAgain": "Less again",
  "ivtabs.level.part": "Part of the dose",
  "ivtabs.summary": "Same dose, two routes. By mouth, part of it is absorbed. By IV, all of it enters the blood.",
  "ivtabs.note": "Illustration, not to scale. Real amounts depend on the nutrient, the dose and the person.",
  "ivtabs.absorbed.heading": "How tablets are absorbed",
  "ivtabs.absorbed.body":
    "A tablet dissolves in the stomach. Nutrients are absorbed mostly in the small intestine, through carriers in the gut wall that can only move so much at once. Blood from the gut then flows through the liver before reaching the rest of the body. Some of the dose is lost or held back along the way, and how much depends on the nutrient, the dose, food in the gut and the health of the gut itself.",
  "ivtabs.different.heading": "How an IV drip is different",
  // Ours: the client wrote "given only after tests"; we run labs only where a drip needs them.
  "ivtabs.different.body":
    "An IV drip puts nutrients into a vein, so they are in the blood straight away. They skip the stomach, the gut wall and the first pass through the liver. That is why every drip here is approved by a physician after your health quiz, runs slowly, and starts only once your vitals are in range. Some drips also need recent lab tests.",
  "ivtabs.enough.heading": "When tablets are enough",
  "ivtabs.enough.body":
    "For many people with a varied diet and a healthy gut, food and tablets are enough, and they are usually the first thing a doctor tries. We'll tell you if that's you.",
  "ivtabs.choose.heading": "When a doctor may choose IV",
  "ivtabs.choose.1": "Poor absorption from the gut.",
  "ivtabs.choose.2": "A deficiency found on your blood tests.",
  "ivtabs.choose.3": "Gut conditions that make tablets hard to take or absorb.",
  "ivtabs.choose.4": "When nutrients are needed quickly, as with IV iron for low iron stores.",
  "ivtabs.limits.heading": "The limits, honestly",
  // Ours: the nurse's anaphylaxis kit, as the home page's safety section says.
  "ivtabs.limits.body":
    "IV is a medical procedure. It needs a physician's approval, a trained nurse and checks at every session. It carries small risks that tablets don't, such as bruising at the cannula site or, rarely, an allergic reaction, which is why the nurse brings an anaphylaxis kit to every session.",
  // Ours: the client wrote "when it fits your results".
  "ivtabs.limits.body2":
    "IV isn't better for everyone. It's another route, and a physician approves it only when it fits your answers and your vitals.",
  "ivtabs.limits.link": "See what's in every drip",
  "about.headline": "IV nutrient therapy, run like a clinic.",
  "about.intro":
    "NutriDrip is a clinical service first and a wellness brand a long way second. A registered physician reviews everyone before anything is prepared, a council-registered nurse comes to you, and every dose and batch number is written down.",
  "about.mission":
    "IV therapy is a medical procedure, and it is too often sold as a treat. Our aim is to make it something you can ask hard questions about and get straight answers to — who approved it, what went into it, which batch, and what happens if something goes wrong.",
  "consult.response":
    "Someone from our clinical team will call or write to you. This is a request, not an appointment — nothing is booked and no payment is taken.",
  "footer.legalName": "NutriDrip Health Pvt. Ltd.",
  "footer.registration": "KA/CEA/2024/11872",
  "footer.emergency": "Not a substitute for emergency care. In an emergency call 108.",
} as const;

export type ContentKey = keyof typeof CONTENT_DEFAULTS;

/** Which screen each key appears on, so the editor can group them. */
export const CONTENT_GROUPS: Record<string, ContentKey[]> = {
  "Home — hero": ["home.headline", "home.sub", "home.cta"],
  "Physician's call": ["home.stat2.value", "home.stat2.label"],
  "Home — safety": ["home.safety.heading", "home.contra.body"],
  "Home — why IV and not tablets": ["home.why.heading", "home.why.lede", "home.why.body"],
  "IV vs Tablets — top and the two routes": [
    "ivtabs.heading",
    "ivtabs.lede",
    "ivtabs.tab.label",
    "ivtabs.tab.1.title",
    "ivtabs.tab.1.short",
    "ivtabs.tab.1.body",
    "ivtabs.tab.2.title",
    "ivtabs.tab.2.body",
    "ivtabs.tab.3.title",
    "ivtabs.tab.3.short",
    "ivtabs.tab.3.body",
    "ivtabs.tab.4.title",
    "ivtabs.tab.4.body",
    "ivtabs.tab.5.title",
    "ivtabs.tab.5.short",
    "ivtabs.tab.5.body",
    "ivtabs.iv.label",
    "ivtabs.iv.1.title",
    "ivtabs.iv.1.body",
    "ivtabs.iv.2.title",
    "ivtabs.iv.2.body",
    "ivtabs.level.full",
    "ivtabs.level.less",
    "ivtabs.level.lessAgain",
    "ivtabs.level.part",
    "ivtabs.summary",
    "ivtabs.note",
  ],
  "IV vs Tablets — below the routes": [
    "ivtabs.absorbed.heading",
    "ivtabs.absorbed.body",
    "ivtabs.different.heading",
    "ivtabs.different.body",
    "ivtabs.enough.heading",
    "ivtabs.enough.body",
    "ivtabs.choose.heading",
    "ivtabs.choose.1",
    "ivtabs.choose.2",
    "ivtabs.choose.3",
    "ivtabs.choose.4",
    "ivtabs.limits.heading",
    "ivtabs.limits.body",
    "ivtabs.limits.body2",
    "ivtabs.limits.link",
  ],
  "About page": ["about.headline", "about.intro", "about.mission"],
  "Consultation request": ["consult.response"],
  Footer: ["footer.legalName", "footer.registration", "footer.emergency"],
};

/**
 * Reads every override in one query and merges it over the defaults. A failure
 * returns the defaults rather than an empty page.
 *
 * Cached for one render: the site header and footer read it as well as the
 * page, and a public page load should query once, not twice.
 */
export const getContent = cache(async (): Promise<Record<ContentKey, string>> => {
  try {
    await connectDB();
    const rows = await ContentBlock.find({}).lean<Array<{ key: string; value: string }>>();
    const overrides = Object.fromEntries(rows.filter((r) => r.value?.trim()).map((r) => [r.key, r.value]));
    return { ...CONTENT_DEFAULTS, ...overrides } as Record<ContentKey, string>;
  } catch (err) {
    console.error("getContent() fell back to defaults:", err);
    return { ...CONTENT_DEFAULTS };
  }
});
