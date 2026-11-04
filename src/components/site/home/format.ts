import type { LatePolicy } from "@/lib/billing/late-policy";

/** Figures on the public landing page, written the way the client's labels write them. */
export const num = (n: number) => Number(n).toLocaleString("en-IN");
export const inr = (n: number) => `₹${num(n)}`;

const WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];
export const word = (n: number) => WORDS[n] ?? String(n);

export const duration = (d: { durationMin: number; durationToMin: number | null }) =>
  d.durationToMin && d.durationToMin > d.durationMin
    ? `${d.durationMin}–${d.durationToMin} min`
    : `${d.durationMin} min`;

/** Millilitres are written mL, as on the client's labels. */
export const unitOf = (u: string) => (u === "ml" ? "mL" : u);
export const dose = (i: { dose: number; unit: string }) => `${num(i.dose)} ${unitOf(i.unit)}`;

/**
 * The same amount one unit up ("1,000 mcg" is "1 mg"): the second line the
 * client's labels print under a dose. Derived, never invented.
 */
export const altDose = (i: { dose: number; unit: string }) =>
  i.unit === "mcg" && i.dose >= 1000
    ? `(${num(i.dose / 1000)} mg)`
    : i.unit === "mg" && i.dose >= 1000
      ? `(${num(i.dose / 1000)} g)`
      : null;

export const hours = (h: number) => `${h} hour${h === 1 ? "" : "s"}`;

/** The late-change rule with today's fees, as one sentence after the free window. */
export function lateFees(p: Pick<LatePolicy, "rescheduleFee" | "cancelFee">) {
  const fees =
    p.rescheduleFee === 0 && p.cancelFee === 0
      ? "Inside that, there is still no late fee"
      : p.rescheduleFee === p.cancelFee
        ? `Inside that, moving or cancelling carries a ${inr(p.cancelFee)} late fee`
        : `Inside that, a late fee applies (${inr(p.rescheduleFee)} to move, ${inr(p.cancelFee)} to cancel)`;
  return `${fees}, because the nurse is already dispatched with your batch drawn.`;
}
