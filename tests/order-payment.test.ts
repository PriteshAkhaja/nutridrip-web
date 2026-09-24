import { describe, expect, it } from "vitest";
import { confirmBlockedBy, needsPayment, payState, referenceProblem } from "@/lib/billing/order-payment";

const clinicDraft = { status: "DRAFT", clinicId: "c1", onCredit: false };

describe("clinic orders are paid first", () => {
  it("a clinic's order needs paying unless the clinic is on credit", () => {
    expect(needsPayment(clinicDraft)).toBe(true);
    expect(needsPayment({ ...clinicDraft, onCredit: true })).toBe(false);
  });

  it("an order the pharmacy raises for nobody in particular never does", () => {
    expect(needsPayment({ status: "DRAFT" })).toBe(false);
  });

  it("an order placed before the rule: a draft follows today's terms, anything later is left alone", () => {
    expect(needsPayment({ status: "DRAFT", clinicId: "c1" })).toBe(true);
    expect(needsPayment({ status: "DRAFT", clinicId: "c1" }, true)).toBe(false);
    expect(needsPayment({ status: "CONFIRMED", clinicId: "c1" })).toBe(false);
  });

  it("walks awaiting → submitted → received", () => {
    expect(payState(clinicDraft)).toBe("awaiting");
    expect(payState({ ...clinicDraft, payment: { state: "submitted" } })).toBe("submitted");
    expect(payState({ ...clinicDraft, payment: { state: "received" } })).toBe("received");
    expect(payState({ ...clinicDraft, onCredit: true })).toBe("credit");
  });

  it("cannot be confirmed until the payment is received, and says why", () => {
    expect(confirmBlockedBy(clinicDraft)).toMatch(/Not paid yet/);
    expect(confirmBlockedBy({ ...clinicDraft, payment: { state: "submitted" } })).toMatch(/Check the money has arrived/);
    expect(confirmBlockedBy({ ...clinicDraft, payment: { state: "received" } })).toBeNull();
    expect(confirmBlockedBy({ ...clinicDraft, onCredit: true })).toBeNull();
  });

  it("takes a payment reference as a bank or UPI app shows it", () => {
    expect(referenceProblem("UTR 4521 8899 0012")).toBeNull();
    expect(referenceProblem("CHQ-004512")).toBeNull();
    expect(referenceProblem("12")).toMatch(/Enter the payment reference/);
    expect(referenceProblem("<script>")).toMatch(/Use only/);
  });
});

describe("the invoice of a paid-first order", () => {
  it("says it was paid, instead of asking for the money again", async () => {
    const { termsFor } = await import("@/lib/billing/invoice");
    const credit = "Payable within 30 days of the invoice date.";
    expect(termsFor({}, credit)).toBe(credit);
    expect(termsFor({ payment: { state: "submitted" } }, credit)).toBe(credit);
    expect(termsFor({ payment: { state: "received", method: "upi", reference: "UTR 4521", paidOn: new Date("2026-09-24T00:00:00+05:30") } }, credit)).toBe(
      "Paid in advance on 24 Sept 2026 by UPI, ref UTR 4521. Nothing further is due."
    );
  });
});
