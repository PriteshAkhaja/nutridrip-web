import type { SiteImageKey } from "@/lib/site-images";
import type { Frame } from "@/lib/media/rules";

/**
 * Every photograph on the public site that the super admin can replace
 * (Admin → Site images), one slot per place it appears: the same picture used
 * on two pages is two slots, so changing one page never changes another.
 * Each slot shows its `fallback` from the shipped set until something is
 * uploaded, and goes back to it on "Restore original".
 *
 * Drips are not listed here: each drip is its own slot (dripSlot). Only an
 * upload is shown, in the bag's place on its card (the landing, the Drips
 * list) and in its page's first screen; until then the site shows the drip's
 * bag in its colour (uploadedDripPhotos, the user's rule, 2026-11-03). Keyed by the drip's slug, which never
 * changes once the drip is made (the drip editor does not write it), so a
 * photo survives `npm run seed`, which recreates every drip with a new id.
 *
 * Not replaceable, on purpose: the drip assembly's stills and room photograph
 * (public/images/assembly), which the animation is measured against, and the
 * logo, which is drawn, not photographed. Likewise the home page and IV vs
 * Tablets (the client's design, 2026-11-02; public/site/v3): every picture
 * there is a plane of the scroll composition, the room, the prep table, the
 * bags, the glass and the tablets-and-IV-line pair, cut and placed per screen
 * with a separate phone file, and the hero's label is set over its bag to
 * the pixel. The home page therefore has no slots. Nor has a drip's own page
 * (2026-11-03): its one picture is the companion bag, built from the drip's
 * own ingredients as they are read (an upload of the drip's own photo shows in
 * its first screen). Nor has the Drips list (2026-11-03): its pictures are
 * the drips' own cards. How it works (2026-11-03) keeps only its first
 * screen: its steps are the relay, drawn from the app's own facts. So does
 * Safety (2026-11-03): its reference ranges are the vitals gate. Pricing
 * (2026-11-03) has no photographs: it is a price list. Nor has Zones
 * (2026-11-03): a pincode check and the zones themselves. Nor have FAQs
 * (2026-11-03): a page for reading.
 *
 * Pure: the admin screen, the upload route and the pages all read it.
 */

export type SlotDef = {
  /** PAGES key: the page it appears on. */
  page: PageKey;
  /** The section, in the words of the page. */
  label: string;
  fallback: SiteImageKey;
  /** The size it is drawn at on the page, in CSS px, measured at 1440 wide. */
  frame: Frame;
  /** The same place on a phone (390 wide): often another shape, so the crop differs. */
  phone: Frame;
  /**
   * The largest it is drawn at any width (390–1920), where that is more than
   * `frame`: the redesigned pages go to one column below 861 px, and just
   * under that the photo spans the whole column. An upload must cover it too
   * (coverOf), or it is stretched there. The previews keep the two shapes above.
   */
  largest?: Frame;
};

export const PAGES = [
  { key: "how-it-works", name: "How it works", path: "/how-it-works" },
  { key: "safety", name: "Safety", path: "/safety" },
  { key: "for-clinics", name: "For clinics", path: "/for-clinics" },
  {
    key: "about",
    name: "About",
    path: "/about",
    note: "Only an uploaded photo is shown: a real photograph of the team, on its card. Until one is uploaded the card has none; the pictures here are stand-ins, not on the site.",
  },
] as const;
export type PageKey = (typeof PAGES)[number]["key"];

export const SLOTS = {
  // Measured on the redesigned pages, 2026-11-04.
  "how-it-works.hero": {
    page: "how-it-works",
    label: "First screen",
    fallback: "vialCheck",
    frame: { w: 511, h: 449 },
    phone: { w: 351, h: 264 },
    largest: { w: 774, h: 582 },
  },
  "safety.hero": {
    page: "safety",
    label: "First screen",
    fallback: "vitalsHome",
    // A wide strip under the heading (2026-11-03), at 1440 × 900.
    frame: { w: 1120, h: 413 },
    phone: { w: 351, h: 263 },
    largest: { w: 774, h: 581 },
  },

  "for-clinics.hero": {
    page: "for-clinics",
    label: "First screen",
    fallback: "dripStand",
    frame: { w: 511, h: 449 },
    phone: { w: 351, h: 264 },
    largest: { w: 774, h: 582 },
  },

  "about.physicians": {
    page: "about",
    label: "Who does what: physicians",
    fallback: "physician",
    frame: { w: 305, h: 275 },
    phone: { w: 314, h: 283 },
    largest: { w: 734, h: 661 },
  },
  "about.nurses": {
    page: "about",
    label: "Who does what: nurses",
    fallback: "nursePrep",
    frame: { w: 305, h: 275 },
    phone: { w: 314, h: 283 },
    largest: { w: 734, h: 661 },
  },
  "about.pharmacy": {
    page: "about",
    label: "Who does what: pharmacy and operations",
    fallback: "pharmacist",
    frame: { w: 305, h: 275 },
    phone: { w: 314, h: 283 },
    largest: { w: 734, h: 661 },
  },
} as const satisfies Record<string, SlotDef>;

export type SlotKey = keyof typeof SLOTS;

export function isSlotKey(key: string): key is SlotKey {
  return Object.prototype.hasOwnProperty.call(SLOTS, key);
}

/** A drip's own photograph: keyed by its slug ("drip.hydrate-plus"), the drip's lasting name. */
export function dripSlot(slug: string): string {
  return `drip.${slug}`;
}
export function dripSlugOf(slot: string): string | null {
  const m = /^drip\.([a-z0-9-]{1,60})$/.exec(slot);
  return m ? m[1] : null;
}

/**
 * An uploaded drip photo is drawn largest under the description on its own
 * page: 2:1, 652 × 326 at 1920 (612 × 306 at 1440). Its card shows it smaller,
 * in the bag's tall box (about 68 × 141), cropped around the same focal point.
 */
export const DRIP_FRAME: Frame = { w: 652, h: 326 };
/** And on its page on a phone (390 wide), beside the bag's strip. */
export const DRIP_PHONE: Frame = { w: 254, h: 127 };

/**
 * The box an upload must cover for a place: the most it is drawn at, wide and
 * tall, at any screen width (its frame, its phone size and `largest`), or null
 * if it is not a place on the site.
 */
export function coverOf(slot: string): Frame | null {
  if (!isSlotKey(slot)) return dripSlugOf(slot) ? DRIP_FRAME : null;
  const s: SlotDef = SLOTS[slot];
  const all = [s.frame, s.phone, s.largest ?? s.frame];
  return { w: Math.max(...all.map((f) => f.w)), h: Math.max(...all.map((f) => f.h)) };
}
