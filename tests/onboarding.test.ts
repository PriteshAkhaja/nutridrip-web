import { describe, expect, it } from "vitest";
import { onboardingOf, PLACEHOLDER_NAME } from "@/lib/auth/onboarding";

const complete = {
  name: "Riya Mehta",
  patient: { address: "402, Brigade Towers, 7th Cross", city: "Bengaluru", pincode: "560034" },
};

describe("patient onboarding", () => {
  it("passes a record a nurse could actually be sent to", () => {
    const state = onboardingOf(complete);
    expect(state.complete).toBe(true);
    expect(state.missing).toEqual([]);
  });

  it("blocks the account an OTP sign-in leaves behind", () => {
    // POST /api/auth/otp/verify creates exactly this: a phone, a placeholder
    // name, and no patient sub-document at all.
    const state = onboardingOf({ name: PLACEHOLDER_NAME });
    expect(state.complete).toBe(false);
    expect(state.missing).toEqual(["name", "address", "city", "pincode"]);
  });

  it("treats the placeholder name as no name", () => {
    // Checklist step ps-02 is the nurse verifying identity by name, and
    // "New patient" verifies nobody.
    expect(onboardingOf({ ...complete, name: PLACEHOLDER_NAME }).missing).toContain("name");
    expect(onboardingOf({ ...complete, name: "   " }).missing).toContain("name");
  });

  it("requires a pincode zoneForPincode() could match", () => {
    const short = onboardingOf({ ...complete, patient: { ...complete.patient, pincode: "5600" } });
    expect(short.missing).toEqual(["pincode"]);
    const letters = onboardingOf({ ...complete, patient: { ...complete.patient, pincode: "56003x" } });
    expect(letters.missing).toEqual(["pincode"]);
  });

  it("does not accept whitespace as an address", () => {
    const state = onboardingOf({ ...complete, patient: { ...complete.patient, address: "   " } });
    expect(state.complete).toBe(false);
    expect(state.missing).toEqual(["address"]);
  });

  it("accepts an unserved pincode — booking refuses that, not sign-up", () => {
    // 110001 is Delhi: outside every zone, but a real address. Onboarding is
    // about having one, not about whether we cover it yet.
    const state = onboardingOf({ ...complete, patient: { ...complete.patient, pincode: "110001" } });
    expect(state.complete).toBe(true);
  });

  it("treats a missing record as incomplete rather than throwing", () => {
    expect(onboardingOf(null).complete).toBe(false);
  });
});
