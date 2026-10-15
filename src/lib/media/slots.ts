import type { SiteImageKey } from "@/lib/site-images";
import type { Frame } from "@/lib/media/rules";

/**
 * Every photograph on the public site that the super admin can replace
 * (Admin → Site images), one slot per place it appears: the same picture used
 * on two pages is two slots, so changing one page never changes another.
 * Each slot shows its `fallback` from the shipped set until something is
 * uploaded, and goes back to it on "Restore original".
 *
 * Drips are not listed here: each drip is its own slot (dripSlot), shown on
 * its card, its page and the Drips menu. Keyed by the drip's slug, which never
 * changes once the drip is made (the drip editor does not write it), so a
 * photo survives `npm run seed`, which recreates every drip with a new id.
 *
 * Not replaceable, on purpose: the drip assembly's stills and room photograph
 * (public/images/assembly), which the animation is measured against, the
 * logo, which is drawn, not photographed, and the home page's plain first
 * screen, which only appears if no drip is Live and public, so the drip
 * animation always takes its place.
 *
 * Pure: the admin screen, the upload route and the pages all read it.
 */

export type SlotDef = {
  /** PAGES key: the page it appears on. */
  page: PageKey;
  /** The section, in the words of the page. */
  label: string;
  fallback: SiteImageKey;
  /** The size it is drawn at on the page, in CSS px, measured at 1440 wide (the largest it gets). */
  frame: Frame;
  /** The same place on a phone (390 wide): often another shape, so the crop differs. */
  phone: Frame;
};

export const PAGES = [
  { key: "home", name: "Home", path: "/" },
  { key: "how-it-works", name: "How it works", path: "/how-it-works" },
  { key: "drips", name: "Drips", path: "/drips" },
  { key: "drip-page", name: "Every drip page", path: "/drips/hydrate-plus" },
  { key: "pricing", name: "Pricing", path: "/pricing" },
  { key: "safety", name: "Safety", path: "/safety" },
  { key: "zones", name: "Zones", path: "/zones" },
  { key: "for-clinics", name: "For clinics", path: "/for-clinics" },
  { key: "about", name: "About", path: "/about" },
  { key: "faqs", name: "FAQs", path: "/faqs" },
] as const;
export type PageKey = (typeof PAGES)[number]["key"];

export const SLOTS = {
  "home.step-physician": {
    page: "home",
    label: "How it works: a physician reviews it",
    fallback: "physicianPhone",
    frame: { w: 577, h: 663 },
    phone: { w: 342, h: 428 },
  },
  "home.step-nurse": {
    page: "home",
    label: "How it works: a nurse comes to you",
    fallback: "vitalsHome",
    frame: { w: 577, h: 663 },
    phone: { w: 342, h: 428 },
  },
  "home.goal-energy": {
    page: "home",
    label: "By goal: Energy",
    fallback: "goalEnergy",
    frame: { w: 387, h: 483 },
    phone: { w: 267, h: 333 },
  },
  "home.goal-immunity": {
    page: "home",
    label: "By goal: Immunity",
    fallback: "goalTravel",
    frame: { w: 387, h: 483 },
    phone: { w: 267, h: 333 },
  },
  "home.goal-skin": {
    page: "home",
    label: "By goal: Skin",
    fallback: "goalSkin2",
    frame: { w: 387, h: 483 },
    phone: { w: 267, h: 333 },
  },
  "home.goal-hydration": {
    page: "home",
    label: "By goal: Hydration",
    fallback: "dripChamber",
    frame: { w: 387, h: 483 },
    phone: { w: 267, h: 333 },
  },
  "home.goal-athletic-recovery": {
    page: "home",
    label: "By goal: Athletic recovery",
    fallback: "goalAthletic",
    frame: { w: 387, h: 483 },
    phone: { w: 267, h: 333 },
  },
  "home.goal-post-viral": {
    page: "home",
    label: "By goal: Post-viral",
    fallback: "goalPostviral",
    frame: { w: 387, h: 483 },
    phone: { w: 267, h: 333 },
  },
  "home.safety": {
    page: "home",
    label: "Where the safety sits",
    fallback: "vialsMono",
    frame: { w: 515, h: 592 },
    phone: { w: 342, h: 308 },
  },
  "home.not-for-everyone": {
    page: "home",
    label: "Not for everyone",
    fallback: "dripWindowLight",
    frame: { w: 527, h: 455 },
    phone: { w: 340, h: 260 },
  },
  "home.closing": {
    page: "home",
    label: "Closing panel",
    fallback: "dripLineWindow",
    frame: { w: 552, h: 638 },
    phone: { w: 342, h: 252 },
  },

  "how-it-works.hero": {
    page: "how-it-works",
    label: "First screen",
    fallback: "vialCheck",
    frame: { w: 557, h: 490 },
    phone: { w: 342, h: 257 },
  },
  "how-it-works.step-physician": {
    page: "how-it-works",
    label: "Step: a physician reviews it",
    fallback: "physicianPhone",
    frame: { w: 588, h: 676 },
    phone: { w: 286, h: 358 },
  },
  "how-it-works.step-slot": {
    page: "how-it-works",
    label: "Step: you choose a drip and a slot",
    fallback: "citySkyline",
    frame: { w: 588, h: 676 },
    phone: { w: 286, h: 358 },
  },
  "how-it-works.step-nurse": {
    page: "how-it-works",
    label: "Step: your nurse sets off",
    fallback: "cityStreet",
    frame: { w: 588, h: 676 },
    phone: { w: 286, h: 358 },
  },
  "how-it-works.step-proof": {
    page: "how-it-works",
    label: "Step: proof they are with you",
    fallback: "vitalsHome",
    frame: { w: 588, h: 676 },
    phone: { w: 286, h: 358 },
  },
  "how-it-works.step-session": {
    page: "how-it-works",
    label: "Step: the session",
    fallback: "homeHero",
    frame: { w: 588, h: 676 },
    phone: { w: 286, h: 358 },
  },
  "how-it-works.closing": {
    page: "how-it-works",
    label: "Closing panel",
    fallback: "dripLineWindow",
    frame: { w: 552, h: 519 },
    phone: { w: 342, h: 252 },
  },

  "drips.closing": {
    page: "drips",
    label: "Closing panel",
    fallback: "dripStand",
    frame: { w: 552, h: 556 },
    phone: { w: 342, h: 252 },
  },

  "drip-page.session": {
    page: "drip-page",
    label: "How a session runs",
    fallback: "vitalsHome",
    frame: { w: 532, h: 585 },
    phone: { w: 342, h: 282 },
  },
  "drip-page.closing": {
    page: "drip-page",
    label: "Closing panel",
    fallback: "nursePrep",
    frame: { w: 552, h: 622 },
    phone: { w: 342, h: 252 },
  },

  "pricing.hero": {
    page: "pricing",
    label: "First screen",
    fallback: "dripBag",
    frame: { w: 557, h: 512 },
    phone: { w: 342, h: 257 },
  },
  "pricing.closing": {
    page: "pricing",
    label: "Closing panel",
    fallback: "dripChamber",
    frame: { w: 552, h: 556 },
    phone: { w: 342, h: 252 },
  },

  "safety.hero": {
    page: "safety",
    label: "First screen",
    fallback: "vitalsHome",
    frame: { w: 557, h: 490 },
    phone: { w: 342, h: 257 },
  },
  "safety.ranges": {
    page: "safety",
    label: "Reference ranges",
    fallback: "vialsMono",
    frame: { w: 511, h: 613 },
    phone: { w: 342, h: 291 },
  },

  "zones.hero": {
    page: "zones",
    label: "First screen",
    fallback: "bengaluruDusk",
    frame: { w: 557, h: 490 },
    phone: { w: 342, h: 257 },
  },
  "zones.closing": {
    page: "zones",
    label: "Closing panel",
    fallback: "cityStreet",
    frame: { w: 552, h: 525 },
    phone: { w: 342, h: 252 },
  },

  "for-clinics.hero": {
    page: "for-clinics",
    label: "First screen",
    fallback: "dripStand",
    frame: { w: 557, h: 490 },
    phone: { w: 342, h: 257 },
  },
  "for-clinics.economics": {
    page: "for-clinics",
    label: "The economics",
    fallback: "pharmacist",
    frame: { w: 540, h: 621 },
    phone: { w: 342, h: 282 },
  },

  "about.physicians": {
    page: "about",
    label: "Who does what: physicians",
    fallback: "physician",
    frame: { w: 384, h: 346 },
    phone: { w: 342, h: 308 },
  },
  "about.nurses": {
    page: "about",
    label: "Who does what: nurses",
    fallback: "nursePrep",
    frame: { w: 384, h: 346 },
    phone: { w: 342, h: 308 },
  },
  "about.pharmacy": {
    page: "about",
    label: "Who does what: pharmacy and operations",
    fallback: "pharmacist",
    frame: { w: 384, h: 346 },
    phone: { w: 342, h: 308 },
  },
  "about.closing": {
    page: "about",
    label: "Closing panel",
    fallback: "homeHero",
    frame: { w: 552, h: 519 },
    phone: { w: 342, h: 252 },
  },

  "faqs.closing": {
    page: "faqs",
    label: "Closing panel",
    fallback: "physicianPhone",
    frame: { w: 552, h: 519 },
    phone: { w: 342, h: 252 },
  },
} as const satisfies Record<string, SlotDef>;

export type SlotKey = keyof typeof SLOTS;

export function isSlotKey(key: string): key is SlotKey {
  return Object.prototype.hasOwnProperty.call(SLOTS, key);
}

/** The home page's "By goal" tile for a category, as a slot. */
export function goalTileSlot(category: string): SlotKey | null {
  const key = `home.goal-${category
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;
  return isSlotKey(key) ? key : null;
}

/** A drip's own photograph: keyed by its slug ("drip.hydrate-plus"), the drip's lasting name. */
export function dripSlot(slug: string): string {
  return `drip.${slug}`;
}
export function dripSlugOf(slot: string): string | null {
  const m = /^drip\.([a-z0-9-]{1,60})$/.exec(slot);
  return m ? m[1] : null;
}

/** A drip's photograph is drawn largest on its own page (about 590 × 695), smaller on its card. */
export const DRIP_FRAME: Frame = { w: 592, h: 694 };
/** And on its page on a phone. */
export const DRIP_PHONE: Frame = { w: 342, h: 368 };

/** The size a place draws its photo at, or null if it is not a place on the site. */
export function frameOf(slot: string): Frame | null {
  if (isSlotKey(slot)) return SLOTS[slot].frame;
  return dripSlugOf(slot) ? DRIP_FRAME : null;
}
