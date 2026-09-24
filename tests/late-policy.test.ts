import { describe, expect, it } from "vitest";
import { LATE_POLICY_DEFAULTS, isLate, lateFee, latePolicySentence, tidyPolicy } from "@/lib/billing/late-policy";

const P = LATE_POLICY_DEFAULTS;

describe("late changes", () => {
  it("defaults to the rule the site always stated: 4 hours, ₹500", () => {
    expect(P).toEqual({ windowHours: 4, rescheduleFee: 500, cancelFee: 500 });
  });

  it("is free outside the window and charged inside it, a past slot included", () => {
    expect(lateFee(P, 4, "late_reschedule")).toBe(0);
    expect(lateFee(P, 3.9, "late_reschedule")).toBe(500);
    expect(lateFee(P, -1, "late_cancel")).toBe(500);
    expect(isLate(P, 10)).toBe(false);
  });

  it("charges each kind its own fee", () => {
    const p = { windowHours: 24, rescheduleFee: 300, cancelFee: 800 };
    expect(lateFee(p, 5, "late_reschedule")).toBe(300);
    expect(lateFee(p, 5, "late_cancel")).toBe(800);
  });

  it("states the rule in words that follow the numbers", () => {
    expect(latePolicySentence(P)).toBe(
      "Move or cancel freely up to 4 hours before your slot. Inside that, moving or cancelling carries a ₹500 late fee, because the nurse is already dispatched with your batch drawn."
    );
    expect(latePolicySentence({ windowHours: 24, rescheduleFee: 300, cancelFee: 800 })).toContain(
      "a late fee applies (₹300 to move, ₹800 to cancel)"
    );
    expect(latePolicySentence({ windowHours: 1, rescheduleFee: 0, cancelFee: 0 })).toContain("up to 1 hour before");
  });

  it("never stores a nonsense policy", () => {
    expect(tidyPolicy(null)).toEqual(P);
    expect(tidyPolicy({ windowHours: 0, rescheduleFee: -5, cancelFee: 250.6 })).toEqual({ windowHours: 1, rescheduleFee: 0, cancelFee: 251 });
  });
});
