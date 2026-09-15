/** Shared enums and literal unions used across models and UI. */

export const ROLES = ["superadmin", "admin", "doctor", "nurse", "clinic", "patient"] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUS = ["active", "inactive", "pending", "suspended"] as const;
export type UserStatus = (typeof USER_STATUS)[number];

/* ---------------- Inventory ---------------- */

export const CATEGORIES = ["DRUG", "FLUID", "CONSUMABLE", "PREMED"] as const;
export type Category = (typeof CATEGORIES)[number];

export const INGREDIENT_ROLES = ["ACTIVE", "FLUID", "PREMED", "ADDITIVE"] as const;
export type IngredientRole = (typeof INGREDIENT_ROLES)[number];

export const UNITS = ["mg", "mcg", "g", "ml", "IU", "unit"] as const;
export type Unit = (typeof UNITS)[number];

export const UNIT_FORMS = ["Vial", "Ampoule", "Bottle", "Bag", "Piece", "Sachet"] as const;
export type UnitForm = (typeof UNIT_FORMS)[number];

export const ORDER_STATUS = ["DRAFT", "CONFIRMED", "DISPATCHED", "CANCELLED"] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

export const TXN_TYPES = ["RECEIPT", "RESERVE", "RELEASE", "CONSUME", "ADJUST", "DISPOSE"] as const;
export type TxnType = (typeof TXN_TYPES)[number];

/* ---------------- Clinical ---------------- */

export const ROUTES = [
  "IV Drip in NS",
  "IV Drip in RL",
  "IV Push/Bolus",
  "IM Injection",
  "Add to Drip Bag",
  "Oral",
] as const;
export type AdminRoute = (typeof ROUTES)[number];

export const PLAN_STATUS = ["draft", "awaiting_review", "active", "completed", "archived"] as const;
export type PlanStatus = (typeof PLAN_STATUS)[number];

export const BOOKING_STATUS = [
  "draft",
  "awaiting_review",
  "approved",
  "rejected",
  "nurse_assigned",
  "en_route",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type BookingStatus = (typeof BOOKING_STATUS)[number];

export const LOCATIONS = ["home", "clinic", "office", "hotel"] as const;
export type SessionLocation = (typeof LOCATIONS)[number];

export const CHECKLIST_PHASES = [
  "Pre-session",
  "Preparation",
  "During infusion",
  "Post-session",
] as const;
export type ChecklistPhase = (typeof CHECKLIST_PHASES)[number];

export const SEVERITY = ["mild", "moderate", "severe"] as const;
export type Severity = (typeof SEVERITY)[number];

/* ---------------- Quiz ---------------- */

export const NUTRIENT_GROUPS = [
  "Vitamins",
  "Minerals",
  "Amino acids",
  "Hydration",
  "Metabolic",
  "Antioxidants",
  "Immunity",
] as const;
export type NutrientGroup = (typeof NUTRIENT_GROUPS)[number];

/** Risk bands used by the design system's `risk()` helper. */
export type RiskBand = "Critical" | "Low" | "Adequate";

export function riskBand(pct: number): RiskBand {
  return pct < 35 ? "Critical" : pct < 60 ? "Low" : "Adequate";
}

export function riskColor(pct: number): string {
  return pct < 35 ? "#C0453C" : pct < 60 ? "#C07A22" : "#2F8F5B";
}

/**
 * What a drip is FOR, as the public catalogue groups them.
 *
 * Defined once. It used to live in three places — a hard-coded chip list on
 * the catalogue, a slug-to-category lookup in the read model, and the
 * marketing copy — which meant a drip created in the admin had no category at
 * all and silently became "Wellness", invisible to every filter on the site.
 *
 * A fixed list rather than free text, for the same reason nurse zones are
 * ticked rather than typed: "immunity" and "Immunity" would become two
 * categories, and the chips match exactly.
 */
export const DRIP_CATEGORIES = [
  "Energy",
  "Immunity",
  "Skin",
  "Hydration",
  "Athletic recovery",
  "Post-viral",
] as const;

export type DripCategory = (typeof DRIP_CATEGORIES)[number];
