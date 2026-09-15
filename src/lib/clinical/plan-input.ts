import type { AdminRoute, Unit } from "@/lib/models/types";

/**
 * A treatment plan before it is saved.
 *
 * Pure, and deliberately so: the builder form and the POST handler both shape
 * a plan, and when the two disagree the physician sees one thing on screen and
 * the nurse reads another off the prescription. One module, imported by both.
 */

/** One drug on one session — what, how much, and how it goes in. */
export type PlanComponentInput = {
  /** The stocked product this line draws from, when it is a stocked product. */
  masterId?: string;
  name: string;
  dose: number;
  unit: Unit;
  route: AdminRoute;
  carrier?: string;
};

/** The bag a drug is added to when it is not the fluid itself. */
export const DEFAULT_CARRIER = "NS 500 ml";

/** Days between sessions inside one week, when a week carries more than one. */
export const DEFAULT_SPACING_DAYS = 3;

/**
 * How a recipe line is given, before the physician says otherwise.
 *
 * A drip recipe records what is IN the bag, not how it reaches the patient —
 * that second half is a prescribing decision, and it is the part that changes
 * per patient. These are the defaults the form starts from: the fluid is the
 * drip itself, everything else is added to that bag.
 */
export function routeForRole(role: string | undefined): AdminRoute {
  return role === "FLUID" ? "IV Drip in NS" : "Add to Drip Bag";
}

export function carrierForRole(role: string | undefined): string | undefined {
  return role === "FLUID" ? undefined : DEFAULT_CARRIER;
}

export type RecipeLine = {
  masterId?: unknown;
  name?: string;
  dose: number;
  unit: string;
  role?: string;
};

/**
 * A drip's recipe, opened out into editable prescription lines.
 *
 * `masterId` is carried through rather than dropped: a line that names a
 * stocked product can be checked against the shelf and traced in a recall, and
 * a line that is only a typed name cannot. That is the whole reason the
 * physician picks components instead of typing them.
 */
export function componentsFromRecipe(ingredients: RecipeLine[]): PlanComponentInput[] {
  return ingredients.map((i) => ({
    masterId: i.masterId ? String(i.masterId) : undefined,
    name: i.name ?? "",
    dose: i.dose,
    unit: i.unit as Unit,
    route: routeForRole(i.role),
    carrier: carrierForRole(i.role),
  }));
}

/* ------------------------------------------------------------------ */
/* Dates                                                               */
/* ------------------------------------------------------------------ */

/**
 * A calendar day, held at UTC midnight.
 *
 * `new Date("2026-09-15")` is already UTC midnight, and that is what every
 * plan written so far has stored. Doing the arithmetic in UTC too keeps a
 * course from drifting a day when it crosses a month boundary.
 */
export function parseDay(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
}

export function toDay(date: Date | string): string {
  return new Date(date).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  const d = parseDay(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toDay(d);
}

/**
 * The days a course falls on: one week apart, and inside a week spaced out
 * rather than stacked on the same morning.
 */
export function scheduleDays({
  startDate,
  totalWeeks,
  perWeek,
  spacingDays = DEFAULT_SPACING_DAYS,
}: {
  startDate: string;
  totalWeeks: number;
  perWeek: number;
  spacingDays?: number;
}): Array<{ weekNum: number; day: string }> {
  const out: Array<{ weekNum: number; day: string }> = [];
  for (let w = 1; w <= totalWeeks; w++) {
    for (let n = 0; n < perWeek; n++) {
      out.push({ weekNum: w, day: addDays(startDate, (w - 1) * 7 + n * spacingDays) });
    }
  }
  return out;
}

/**
 * Whether naming a carrier means anything for this route.
 *
 * "IV Drip in NS" already says what the fluid is, and nothing is carried at
 * all when a drug is pushed, injected into muscle or swallowed. Only a drug
 * added to somebody else's bag needs the bag named.
 */
export function carrierApplies(route: AdminRoute): boolean {
  return route === "Add to Drip Bag";
}
