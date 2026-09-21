import { connectDB } from "@/lib/db/mongoose";
import { ContentBlock } from "@/lib/models";

/**
 * Editable copy on the public site. Every key has a fallback written here, so
 * the site renders correctly on a fresh database and a deleted row is a
 * revert rather than a blank.
 */
export const CONTENT_DEFAULTS = {
  "home.badge": "Physician-approved · nurse-administered",
  "home.headline": "IV nutrient therapy, at home, with a doctor in the loop.",
  "home.sub":
    "Answer a 16-point health quiz, get a protocol reviewed by a registered physician, and have a nurse administer it in your own home. No walk-in, no guesswork.",
  "home.cta": "Take the health quiz · 3 min",
  "home.stat1.value": "4.9",
  "home.stat1.label": "avg. nurse rating",
  "home.stat2.value": "2 hr",
  "home.stat2.label": "typical review time",
  "home.stat3.value": "14",
  "home.stat3.label": "zones served in Bengaluru",
  "home.safety.heading": "Where the safety actually sits",
  "home.safety.body":
    "Every session is bounded by a 29-step checklist the nurse cannot skip, and out-of-range vitals stop the infusion before it starts.",
  "home.contra.heading": "Not for everyone",
  "home.contra.body":
    "IV therapy is unsuitable during pregnancy, in renal or cardiac failure, and with certain drug interactions. The quiz screens for these and a physician can decline.",
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
  "Home — hero": ["home.badge", "home.headline", "home.sub", "home.cta"],
  "Home — the three figures": [
    "home.stat1.value", "home.stat1.label",
    "home.stat2.value", "home.stat2.label",
    "home.stat3.value", "home.stat3.label",
  ],
  "Home — safety": ["home.safety.heading", "home.safety.body", "home.contra.heading", "home.contra.body"],
  "About page": ["about.headline", "about.intro", "about.mission"],
  "Consultation request": ["consult.response"],
  Footer: ["footer.legalName", "footer.registration", "footer.emergency"],
};

/**
 * Reads every override in one query and merges it over the defaults. A failure
 * returns the defaults rather than an empty page.
 */
export async function getContent(): Promise<Record<ContentKey, string>> {
  try {
    await connectDB();
    const rows = await ContentBlock.find({}).lean<Array<{ key: string; value: string }>>();
    const overrides = Object.fromEntries(
      rows.filter((r) => r.value?.trim()).map((r) => [r.key, r.value])
    );
    return { ...CONTENT_DEFAULTS, ...overrides } as Record<ContentKey, string>;
  } catch (err) {
    console.error("getContent() fell back to defaults:", err);
    return { ...CONTENT_DEFAULTS };
  }
}
