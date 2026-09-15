import type { Unit } from "@/lib/models/types";

/** Unit families. Conversion is only ever valid inside one family. */
const FAMILY: Record<Unit, "mass" | "volume" | "activity" | "count"> = {
  mcg: "mass",
  mg: "mass",
  g: "mass",
  ml: "volume",
  IU: "activity",
  unit: "count",
};

/** Factor to the family's base unit: mcg for mass, ml for volume, 1 otherwise. */
const TO_BASE: Record<Unit, number> = {
  mcg: 1,
  mg: 1_000,
  g: 1_000_000,
  ml: 1,
  IU: 1,
  unit: 1,
};

export function sameFamily(a: Unit, b: Unit): boolean {
  return FAMILY[a] === FAMILY[b];
}

/**
 * Convert `value` from `from` to `to`. Returns null across families — that is
 * a unit slip, and the caller must surface it rather than guess.
 */
export function convert(value: number, from: Unit, to: Unit): number | null {
  if (!sameFamily(from, to)) return null;
  return (value * TO_BASE[from]) / TO_BASE[to];
}

export function formatQty(value: number, unit: Unit): string {
  const rounded = Math.abs(value) >= 100 ? Math.round(value) : Math.round(value * 100) / 100;
  return `${rounded.toLocaleString("en-IN")} ${unit}`;
}

/** Indian grouping, no decimals — the format every rupee figure uses. */
export function formatInr(rupees: number): string {
  return `₹${Math.round(rupees).toLocaleString("en-IN")}`;
}
