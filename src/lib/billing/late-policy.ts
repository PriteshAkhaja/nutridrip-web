import { LATE_CANCEL_FEE_INR, LATE_CHANGE_HOURS } from "@/lib/clinical/slots";

/**
 * What a patient pays for changing a session at the last moment.
 *
 * Up to `windowHours` before the slot, moving or cancelling is free. Inside it
 * the nurse is already dispatched with the batch drawn, so either costs a fee:
 * `rescheduleFee` to move it, `cancelFee` to cancel it. Set on the Billing page;
 * the defaults are the rule the site has always stated.
 */
export type LatePolicy = {
  windowHours: number;
  rescheduleFee: number;
  cancelFee: number;
};

export const LATE_POLICY_DEFAULTS: LatePolicy = {
  windowHours: LATE_CHANGE_HOURS,
  rescheduleFee: LATE_CANCEL_FEE_INR,
  cancelFee: LATE_CANCEL_FEE_INR,
};

export type LateKind = "late_reschedule" | "late_cancel";

/** Is a slot this many hours away inside the window? A slot already past is the deepest part of it. */
export function isLate(policy: LatePolicy, hoursOut: number): boolean {
  return hoursOut < policy.windowHours;
}

/** The fee for this change right now: 0 outside the window. */
export function lateFee(policy: LatePolicy, hoursOut: number, kind: LateKind): number {
  if (!isLate(policy, hoursOut)) return 0;
  return kind === "late_reschedule" ? policy.rescheduleFee : policy.cancelFee;
}

export const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const hours = (h: number) => `${h} hour${h === 1 ? "" : "s"}`;

/**
 * The rule in one sentence, for every page that states it -- the FAQs, pricing,
 * how it works, the terms and the booking screen -- so none of them can drift
 * from what the server charges.
 */
export function latePolicySentence(policy: LatePolicy): string {
  const free = `Move or cancel freely up to ${hours(policy.windowHours)} before your slot.`;
  // Always says "late fee": it is the word a patient searches the FAQ for.
  const move = policy.rescheduleFee > 0 ? `${inr(policy.rescheduleFee)} to move` : "moving stays free";
  const cancel = policy.cancelFee > 0 ? `${inr(policy.cancelFee)} to cancel` : "cancelling stays free";
  const fees =
    policy.rescheduleFee === 0 && policy.cancelFee === 0
      ? "Inside that, there is still no late fee"
      : policy.rescheduleFee === policy.cancelFee
        ? `Inside that, moving or cancelling carries a ${inr(policy.cancelFee)} late fee`
        : `Inside that, a late fee applies (${move}, ${cancel})`;
  return `${free} ${fees}, because the nurse is already dispatched with your batch drawn.`;
}

/** Clamp and tidy what is stored, so a bad row can never produce a negative fee or a zero-hour window. */
export function tidyPolicy(row: Partial<LatePolicy> | null | undefined): LatePolicy {
  const whole = (n: unknown, fallback: number, min: number, max: number) =>
    typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
  return {
    windowHours: whole(row?.windowHours, LATE_POLICY_DEFAULTS.windowHours, 1, 72),
    rescheduleFee: whole(row?.rescheduleFee, LATE_POLICY_DEFAULTS.rescheduleFee, 0, 100_000),
    cancelFee: whole(row?.cancelFee, LATE_POLICY_DEFAULTS.cancelFee, 0, 100_000),
  };
}

/**
 * Stands in the site's static copy (FAQs, terms, pricing) where the rule is
 * stated, and is replaced with latePolicySentence when the page is drawn -- so
 * the words are written once, here, and always carry today's numbers.
 */
export const LATE_POLICY_TOKEN = "{{late-policy}}";

export function fillLatePolicy(text: string, policy: LatePolicy): string {
  return text.includes(LATE_POLICY_TOKEN) ? text.replaceAll(LATE_POLICY_TOKEN, latePolicySentence(policy)) : text;
}
