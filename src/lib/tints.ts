/**
 * A drip's colour on the public site: the liquid in its bag, its card, the
 * band on its label. The super admin picks it in the Drip builder.
 *
 * Decided with the client's design (2026-10-30): one tint per drip, from this
 * palette only. None of these is a clinical hue (safe green, caution amber,
 * critical red), so a drip can never borrow the look of an out-of-range vital.
 * The consoles never show it.
 */
export const SITE_TINTS = [
  { value: "#16A6B6", name: "Teal" },
  { value: "#4B96E6", name: "Sky" },
  { value: "#7B5BD6", name: "Violet" },
  { value: "#A47DDB", name: "Lavender" },
  { value: "#4A4FB5", name: "Indigo" },
  { value: "#B65CC8", name: "Orchid" },
  { value: "#8C3E8A", name: "Plum" },
  { value: "#C13E8D", name: "Magenta" },
  { value: "#DB5B93", name: "Rose" },
] as const;

export type SiteTint = (typeof SITE_TINTS)[number]["value"];
export const SITE_TINT_VALUES = SITE_TINTS.map((t) => t.value) as [SiteTint, ...SiteTint[]];

/**
 * The seeded drips' colours, as approved on the prototype. A drip saved before
 * the field existed, or never given one, falls back here and then to a
 * palette colour picked by its slug, so the site never shows a drip uncoloured.
 */
export const SEED_TINTS: Record<string, SiteTint> = {
  "hydrate-plus": "#16A6B6",
  "jetlag-reset": "#4B96E6",
  "myers-revive": "#7B5BD6",
  "immune-shield": "#C13E8D",
  "post-viral-rebuild": "#A47DDB",
  "iron-restore": "#8C3E8A",
  "athletic-recovery": "#4A4FB5",
  "deep-recharge": "#B65CC8",
  "glow-protocol": "#DB5B93",
};

export function tintFor(drip: { slug: string; tint?: string | null }): SiteTint {
  const set = SITE_TINT_VALUES.find((v) => v === drip.tint);
  if (set) return set;
  if (SEED_TINTS[drip.slug]) return SEED_TINTS[drip.slug];
  let h = 0;
  for (const c of drip.slug) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return SITE_TINT_VALUES[h % SITE_TINT_VALUES.length];
}
