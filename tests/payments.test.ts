import crypto from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiBaseFrom, razorpayConfig } from "@/lib/payments/config";
import { checkoutSignatureValid, razorpay, RazorpayError, webhookSignatureValid } from "@/lib/payments/razorpay";
import {
  allocateRefund,
  bookingMoney,
  bookingPaymentStatus,
  bookingPhase,
  checkSummary,
  failureMessage,
  fromPaise,
  goodwillOf,
  heldOf,
  inrFromPaise,
  methodLabel,
  pendingOf,
  refundEta,
  refundReceipt,
  refundedOf,
  statusAfterRefunds,
  toPaise,
  type HeldPayment,
} from "@/lib/payments/rules";
import { invoiceDueAt, invoicePayState } from "@/lib/billing/invoice-pay";
import { ledgerFilter, parseView } from "@/lib/payments/admin";

const hmac = (secret: string, msg: string) => crypto.createHmac("sha256", secret).update(msg).digest("hex");

/* ------------------------------------------------------------- config */

describe("Razorpay settings", () => {
  it("is off without both keys", () => {
    expect(razorpayConfig({})).toBeNull();
    expect(razorpayConfig({ RAZORPAY_KEY_ID: "rzp_test_x" })).toBeNull();
    expect(razorpayConfig({ RAZORPAY_KEY_SECRET: "s" })).toBeNull();
  });

  it("tells test keys from live ones", () => {
    expect(razorpayConfig({ RAZORPAY_KEY_ID: "rzp_test_abc", RAZORPAY_KEY_SECRET: "s" })?.mode).toBe("test");
    expect(razorpayConfig({ RAZORPAY_KEY_ID: "rzp_live_abc", RAZORPAY_KEY_SECRET: "s" })?.mode).toBe("live");
  });

  it("refunds at normal speed unless told otherwise", () => {
    const base = { RAZORPAY_KEY_ID: "rzp_test_abc", RAZORPAY_KEY_SECRET: "s" };
    expect(razorpayConfig(base)?.refundSpeed).toBe("normal");
    expect(razorpayConfig({ ...base, RAZORPAY_REFUND_SPEED: "optimum" })?.refundSpeed).toBe("optimum");
    expect(razorpayConfig({ ...base, RAZORPAY_REFUND_SPEED: "instant!" })?.refundSpeed).toBe("normal");
  });

  it("only lets the API be pointed at this machine, never at another host", () => {
    // Anything else would be a way to send the key secret somewhere.
    expect(apiBaseFrom(undefined)).toBe("https://api.razorpay.com/v1");
    expect(apiBaseFrom("http://127.0.0.1:4599/v1/")).toBe("http://127.0.0.1:4599/v1");
    expect(apiBaseFrom("http://localhost:4599/v1")).toBe("http://localhost:4599/v1");
    expect(apiBaseFrom("https://evil.example.com/v1")).toBe("https://api.razorpay.com/v1");
    expect(apiBaseFrom("not a url")).toBe("https://api.razorpay.com/v1");
  });
});

/* --------------------------------------------------------- signatures */

describe("signatures", () => {
  const secret = "key_secret_123";

  it("accepts Checkout's signature over order|payment, and nothing else", () => {
    const sig = hmac(secret, "order_A|pay_B");
    expect(checkoutSignatureValid({ orderId: "order_A", paymentId: "pay_B", signature: sig }, secret)).toBe(true);
    // Swapped ids, another order, a wrong secret, junk: all refused.
    expect(checkoutSignatureValid({ orderId: "pay_B", paymentId: "order_A", signature: sig }, secret)).toBe(false);
    expect(checkoutSignatureValid({ orderId: "order_C", paymentId: "pay_B", signature: sig }, secret)).toBe(false);
    expect(checkoutSignatureValid({ orderId: "order_A", paymentId: "pay_B", signature: sig }, "other")).toBe(false);
    expect(checkoutSignatureValid({ orderId: "order_A", paymentId: "pay_B", signature: "zz" }, secret)).toBe(false);
    expect(checkoutSignatureValid({ orderId: "order_A", paymentId: "pay_B", signature: "" }, secret)).toBe(false);
  });

  it("accepts an upper-case signature (hex is hex)", () => {
    const sig = hmac(secret, "order_A|pay_B").toUpperCase();
    expect(checkoutSignatureValid({ orderId: "order_A", paymentId: "pay_B", signature: sig }, secret)).toBe(true);
  });

  it("checks a webhook against its exact raw body", () => {
    const body = JSON.stringify({ event: "payment.captured", payload: {} });
    const sig = hmac("wh_secret", body);
    expect(webhookSignatureValid(body, sig, "wh_secret")).toBe(true);
    // One byte different -- re-serialised, a space added -- and it fails.
    expect(webhookSignatureValid(`${body} `, sig, "wh_secret")).toBe(false);
    expect(webhookSignatureValid(body, sig, "other")).toBe(false);
    expect(webhookSignatureValid(body, null, "wh_secret")).toBe(false);
  });
});

/* ------------------------------------------------------------- client */

describe("the Razorpay client", () => {
  beforeEach(() => {
    vi.stubEnv("RAZORPAY_KEY_ID", "rzp_test_key");
    vi.stubEnv("RAZORPAY_KEY_SECRET", "secret");
    vi.stubEnv("RAZORPAY_API_BASE", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("creates an order in paise with Basic auth, the receipt cut to Razorpay's 40 characters", async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ id: "order_1", amount: 800000 }), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const order = await razorpay.createOrder({ amount: 800000, receipt: "R".repeat(60), notes: { a: "b" } });
    expect(order.id).toBe("order_1");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.razorpay.com/v1/orders");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).authorization).toBe(
      `Basic ${Buffer.from("rzp_test_key:secret").toString("base64")}`
    );
    const body = JSON.parse(String(init.body));
    expect(body).toMatchObject({ amount: 800000, currency: "INR", notes: { a: "b" } });
    expect(body.receipt).toHaveLength(40);
  });

  it("keeps Razorpay's own words when it refuses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: { code: "BAD_REQUEST_ERROR", description: "The amount must be at least INR 1.00" },
            }),
            { status: 400 }
          )
      )
    );
    const err = await razorpay.createOrder({ amount: 1, receipt: "r" }).catch((e) => e);
    expect(err).toBeInstanceOf(RazorpayError);
    expect(err.message).toBe("The amount must be at least INR 1.00");
    expect(err.status).toBe(400);
    expect(err.code).toBe("BAD_REQUEST_ERROR");
    expect(err.unreachable).toBe(false);
  });

  it("never retries a POST -- a second try could refund twice", async () => {
    const fetchMock = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    vi.stubGlobal("fetch", fetchMock);
    const err = await razorpay.refund("pay_1", { amount: 100, speed: "normal" }).catch((e) => e);
    expect(err).toBeInstanceOf(RazorpayError);
    expect(err.unreachable).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a read once when Razorpay has a bad moment", async () => {
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        ++n === 1
          ? new Response(JSON.stringify({ error: { description: "try later" } }), { status: 503 })
          : new Response(JSON.stringify({ id: "pay_1", status: "captured" }), { status: 200 })
      )
    );
    const p = await razorpay.fetchPayment("pay_1");
    expect(p.status).toBe("captured");
    expect(n).toBe(2);
  });

  it("refuses to run at all without keys", async () => {
    vi.stubEnv("RAZORPAY_KEY_ID", "");
    await expect(razorpay.fetchOrder("order_1")).rejects.toThrow(/not set up/);
  });
});

/* -------------------------------------------------------------- money */

describe("money units", () => {
  it("converts rupees to paise without float drift", () => {
    expect(toPaise(0.1 + 0.2)).toBe(30);
    expect(toPaise(8000)).toBe(800000);
    expect(toPaise(undefined)).toBe(0);
    expect(fromPaise(123456)).toBe(1234.56);
  });

  it("writes rupees the way the rest of the app does", () => {
    expect(inrFromPaise(800000)).toBe("₹8,000");
    expect(inrFromPaise(123450)).toBe("₹1,234.50");
  });

  it("adds up refunds, leaving out the failed ones", () => {
    const refunds = [
      { amount: 100, status: "processed" },
      { amount: 50, status: "pending" },
      { amount: 999, status: "failed" },
    ];
    expect(refundedOf(refunds)).toBe(150);
    expect(pendingOf(refunds)).toBe(50);
    expect(refundedOf(undefined)).toBe(0);
    expect(statusAfterRefunds(1000, 0)).toBe("paid");
    expect(statusAfterRefunds(1000, 400)).toBe("partially_refunded");
    expect(statusAfterRefunds(1000, 1000)).toBe("refunded");
  });
});

const paid = (id: string, purpose: string, rupees: number, refundedRupees = 0, at = 1): HeldPayment => ({
  id,
  purpose,
  amount: toPaise(rupees),
  refunded: toPaise(refundedRupees),
  paidAt: at,
});

describe("what a session's money should be", () => {
  it("knows a session to come, one that ran, and one that will not", () => {
    expect(bookingPhase("nurse_assigned")).toBe("active");
    expect(bookingPhase("awaiting_review")).toBe("active");
    expect(bookingPhase("in_progress")).toBe("ran");
    expect(bookingPhase("completed")).toBe("ran");
    expect(bookingPhase("cancelled")).toBe("ended");
    expect(bookingPhase("rejected")).toBe("ended");
  });

  it("a paid session to come: nothing to refund, nothing owed", () => {
    const m = bookingMoney({
      status: "approved",
      amount: 8000,
      endedByPatient: false,
      lateCancelFees: 0,
      payments: [paid("a", "booking", 8000)],
    });
    expect(m.refundDue).toBe(0);
    expect(m.balanceDue).toBe(0);
  });

  it("switched to a cheaper drip: the difference goes back", () => {
    const m = bookingMoney({
      status: "approved",
      amount: 6500,
      endedByPatient: false,
      lateCancelFees: 0,
      payments: [paid("a", "booking", 8000)],
    });
    expect(m.refundDue).toBe(toPaise(1500));
    expect(m.refundFrom).toEqual([{ id: "a", amount: toPaise(1500) }]);
  });

  it("switched to a dearer drip: the difference is a balance to pay", () => {
    const m = bookingMoney({
      status: "nurse_assigned",
      amount: 9500,
      endedByPatient: false,
      lateCancelFees: 0,
      payments: [paid("a", "booking", 8000)],
    });
    expect(m.refundDue).toBe(0);
    expect(m.balanceDue).toBe(toPaise(1500));
  });

  it("cancelled by the patient in good time: everything paid for the session goes back", () => {
    const m = bookingMoney({
      status: "cancelled",
      amount: 8000,
      endedByPatient: true,
      lateCancelFees: 0,
      payments: [paid("a", "booking", 8000)],
    });
    expect(m.refundDue).toBe(toPaise(8000));
    expect(m.kept).toBe(0);
  });

  it("cancelled late by the patient: all but the late fee goes back", () => {
    const m = bookingMoney({
      status: "cancelled",
      amount: 8000,
      endedByPatient: true,
      lateCancelFees: 500,
      payments: [paid("a", "booking", 8000)],
    });
    expect(m.kept).toBe(toPaise(500));
    expect(m.refundDue).toBe(toPaise(7500));
  });

  it("a patient's own late-move fee stays paid when they later cancel", () => {
    const m = bookingMoney({
      status: "cancelled",
      amount: 8000,
      endedByPatient: true,
      lateCancelFees: 0,
      payments: [paid("a", "booking", 8000, 0, 1), paid("f", "reschedule_fee", 500, 0, 2)],
    });
    expect(m.refundDue).toBe(toPaise(8000));
    expect(m.refundFrom.map((r) => r.id)).toEqual(["a"]);
  });

  it("ended by anyone else -- declined, stood down, cancelled by the team -- refunds everything, fees too", () => {
    for (const status of ["cancelled", "rejected"]) {
      const m = bookingMoney({
        status,
        amount: 8000,
        endedByPatient: false,
        lateCancelFees: 0,
        payments: [paid("a", "booking", 8000, 0, 1), paid("f", "reschedule_fee", 500, 0, 2)],
      });
      expect(m.refundDue, status).toBe(toPaise(8500));
      // Newest first: the fee, then the session.
      expect(m.refundFrom, status).toEqual([
        { id: "f", amount: toPaise(500) },
        { id: "a", amount: toPaise(8000) },
      ]);
    }
  });

  it("a session that ran is never refunded automatically", () => {
    const m = bookingMoney({
      status: "completed",
      amount: 8000,
      endedByPatient: false,
      lateCancelFees: 0,
      payments: [paid("a", "booking", 8000)],
    });
    expect(m.refundDue).toBe(0);
  });

  it("run twice, the second run finds nothing more to refund", () => {
    const first = bookingMoney({
      status: "rejected",
      amount: 8000,
      endedByPatient: false,
      lateCancelFees: 0,
      payments: [paid("a", "booking", 8000)],
    });
    const second = bookingMoney({
      status: "rejected",
      amount: 8000,
      endedByPatient: false,
      lateCancelFees: 0,
      payments: [paid("a", "booking", 8000, first.refundDue / 100)],
    });
    expect(second.refundDue).toBe(0);
  });

  it("never refunds more than a payment still holds, and splits across payments newest first", () => {
    expect(
      allocateRefund(
        [
          { id: "old", amount: 800000, refunded: 0, paidAt: 1 },
          { id: "new", amount: 150000, refunded: 50000, paidAt: 2 },
        ],
        300000
      )
    ).toEqual([
      { id: "new", amount: 100000 },
      { id: "old", amount: 200000 },
    ]);
    expect(allocateRefund([{ id: "a", amount: 100, refunded: 100, paidAt: 1 }], 50)).toEqual([]);
  });
});

describe("goodwill given back by hand", () => {
  // A goodwill refund is recorded with `refunded` and, of it, `goodwill`.
  const withGoodwill = (id: string, rupees: number, goodwillRupees: number, otherRefundRupees = 0): HeldPayment => ({
    id,
    purpose: "booking",
    amount: toPaise(rupees),
    refunded: toPaise(goodwillRupees + otherRefundRupees),
    goodwill: toPaise(goodwillRupees),
    paidAt: 1,
  });

  it("never turns into a balance the patient is asked to pay back", () => {
    const m = bookingMoney({
      status: "nurse_assigned",
      amount: 8000,
      endedByPatient: false,
      lateCancelFees: 0,
      payments: [withGoodwill("a", 8000, 500)],
    });
    expect(m.balanceDue).toBe(0);
    expect(m.refundDue).toBe(0);
  });

  it("is not taken out of the difference a cheaper drip gives back", () => {
    const m = bookingMoney({
      status: "approved",
      amount: 6500,
      endedByPatient: false,
      lateCancelFees: 0,
      payments: [withGoodwill("a", 8000, 500)],
    });
    // ₹1,500 for the cheaper drip, on top of the ₹500 already given.
    expect(m.refundDue).toBe(toPaise(1500));
  });

  it("a failed refund retried by hand is recorded as that refund, and nothing more is owed", () => {
    // Switched 8,000 → 6,500; the automatic ₹1,500 failed, the admin sent it
    // again, recorded as the price-change refund it is (not goodwill).
    const m = bookingMoney({
      status: "approved",
      amount: 6500,
      endedByPatient: false,
      lateCancelFees: 0,
      payments: [withGoodwill("a", 8000, 0, 1500)],
    });
    expect(m.refundDue).toBe(0);
    expect(m.balanceDue).toBe(0);
  });

  it("never sends back more than is still held", () => {
    // ₹7,900 of ₹8,000 already given as goodwill; a switch to ₹6,500 cannot return ₹1,500.
    const m = bookingMoney({
      status: "approved",
      amount: 6500,
      endedByPatient: false,
      lateCancelFees: 0,
      payments: [withGoodwill("a", 8000, 7900)],
    });
    expect(m.refundDue).toBe(toPaise(100));
  });

  it("a session called off by the team returns whatever is still held", () => {
    const m = bookingMoney({
      status: "cancelled",
      amount: 8000,
      endedByPatient: false,
      lateCancelFees: 0,
      payments: [withGoodwill("a", 8000, 500)],
    });
    expect(m.refundDue).toBe(toPaise(7500));
  });

  it("is read from the stored refunds: manual ones that did not fail", () => {
    const refunds = [
      { amount: 5000, status: "processed", kind: "manual" },
      { amount: 2000, status: "failed", kind: "manual" },
      { amount: 3000, status: "pending", kind: "cancelled" },
    ];
    expect(goodwillOf(refunds)).toBe(5000);
    const held = heldOf({ _id: "p1", purpose: "booking", amount: 800000, paidAt: new Date(5), refunds });
    expect(held).toEqual({ id: "p1", purpose: "booking", amount: 800000, refunded: 8000, goodwill: 5000, paidAt: 5 });
  });

  it("leaves a paid session paid in the list", () => {
    expect(
      bookingPaymentStatus({
        status: "nurse_assigned",
        corePaidGross: 800000,
        coreRefunded: 50000,
        coreGoodwill: 50000,
        refundPending: 0,
        refundOwed: 0,
        price: 800000,
      })
    ).toBe("paid");
    // The same refund for a rule's reason (a cheaper drip) does leave it short.
    expect(
      bookingPaymentStatus({
        status: "nurse_assigned",
        corePaidGross: 800000,
        coreRefunded: 50000,
        refundPending: 0,
        refundOwed: 0,
        price: 800000,
      })
    ).toBe("balance_due");
  });
});

describe("how long a refund takes, as promised", () => {
  it("minutes for an instant refund, days for a normal one, both for one that will try", () => {
    expect(refundEta("instant")).toBe("usually within minutes");
    expect(refundEta("normal")).toBe("within 5–7 working days");
    expect(refundEta(undefined)).toBe("within 5–7 working days");
    expect(refundEta("optimum")).toMatch(/within minutes.*5–7 working days/);
  });
});

describe("the one word a list shows about a session's money", () => {
  const base = { corePaidGross: 800000, coreRefunded: 0, refundPending: 0, refundOwed: 0, price: 800000 };
  it("unpaid, paid, balance due", () => {
    expect(bookingPaymentStatus({ ...base, status: "approved", corePaidGross: 0 })).toBe("unpaid");
    expect(bookingPaymentStatus({ ...base, status: "approved" })).toBe("paid");
    expect(bookingPaymentStatus({ ...base, status: "approved", price: 950000 })).toBe("balance_due");
  });
  it("money on its way back comes first -- including a refund still owed after a failure", () => {
    expect(bookingPaymentStatus({ ...base, status: "cancelled", coreRefunded: 800000, refundPending: 800000 })).toBe(
      "refund_pending"
    );
    expect(bookingPaymentStatus({ ...base, status: "cancelled", refundOwed: 800000 })).toBe("refund_pending");
  });
  it("refunded in full, or less a late fee", () => {
    expect(bookingPaymentStatus({ ...base, status: "cancelled", coreRefunded: 800000 })).toBe("refunded");
    expect(bookingPaymentStatus({ ...base, status: "cancelled", coreRefunded: 750000 })).toBe("partially_refunded");
  });
});

/* ------------------------------------------------------------ display */

describe("how a payment is described", () => {
  it("names the method the way a bank statement would", () => {
    expect(methodLabel({ method: "upi", vpa: "riya@okhdfc" })).toBe("UPI · riya@okhdfc");
    expect(methodLabel({ method: "card", card: { network: "Visa", last4: "1111" } })).toBe("Visa •••• 1111");
    expect(methodLabel({ method: "card", card: { network: "Unknown", last4: "4242" } })).toBe("Card •••• 4242");
    expect(methodLabel({ method: "netbanking", bank: "HDFC" })).toBe("Net banking · HDFC");
    expect(methodLabel({ method: "wallet", wallet: "paytm" })).toBe("Wallet · Paytm");
    expect(methodLabel({})).toBe("Online");
  });

  it("always says what happens to money that left the account", () => {
    for (const e of [
      { reason: "payment_cancelled" },
      { reason: "insufficient_funds" },
      { description: "Your card was declined" },
      null,
    ]) {
      expect(failureMessage(e)).toMatch(/No money was taken/);
      expect(failureMessage(e)).toMatch(/5–7 working days/);
    }
    expect(failureMessage({ description: "Your card was declined" })).toMatch(/^Your card was declined\./);
  });
});

/* ----------------------------------------------------------- invoices */

describe("invoices on credit", () => {
  const issued = new Date("2026-09-01T10:00:00+05:30");
  it("are due 30 days after they are raised", () => {
    expect(invoiceDueAt(issued).toISOString()).toBe(new Date("2026-10-01T10:00:00+05:30").toISOString());
  });
  it("are due, then overdue, until paid", () => {
    expect(invoicePayState({ issuedAt: issued }, new Date("2026-09-15"))).toBe("due");
    expect(invoicePayState({ issuedAt: issued }, new Date("2026-10-02"))).toBe("overdue");
    expect(invoicePayState({ issuedAt: issued, payment: { state: "paid" } }, new Date("2026-12-01"))).toBe("paid");
  });
  it("count as paid when their order was paid in advance, even from before invoices had a paid state", () => {
    expect(
      invoicePayState({ issuedAt: issued, terms: "Paid in advance on 1 Sept 2026 by UPI." }, new Date("2027-01-01"))
    ).toBe("paid");
  });
});

describe("the Payments page's views", () => {
  it("falls back to all for anything it does not know", () => {
    expect(parseView("attention")).toBe("attention");
    expect(parseView("nonsense")).toBe("all");
    expect(parseView(undefined)).toBe("all");
  });
  it("keeps unfinished checkouts out of the ledger, and in their own view", () => {
    expect(ledgerFilter("all")).toEqual({ status: { $ne: "created" } });
    expect(ledgerFilter("unpaid")).toEqual({ status: { $in: ["created", "failed"] } });
  });
});

describe("refundReceipt", () => {
  it("is never repeated when receipt numbers come round again", () => {
    // The same receipt number on two payments (a database reseeded or restored):
    // Razorpay refused the second with "Duplicate receipt found".
    const before = refundReceipt("RCPT-2026-0003", "6abe27ad0a9a81818489873b", 1);
    const after = refundReceipt("RCPT-2026-0003", "6abf4c120a9a8181848a10f7", 1);
    expect(before).not.toBe(after);
    expect(before).toBe("RCPT-2026-0003-R1-8489873b");
  });

  it("counts the refunds of one payment and stays inside Razorpay's 40 characters", () => {
    expect(refundReceipt("RCPT-2026-0003", "6abe27ad0a9a81818489873b", 2)).toBe("RCPT-2026-0003-R2-8489873b");
    expect(refundReceipt("RCPT-2026-123456", "6abe27ad0a9a81818489873b", 12).length).toBeLessThanOrEqual(40);
  });
});

describe("checkSummary", () => {
  const refund = (amount: number, status: "pending" | "processed" | "failed") => ({ amount, status });

  it('says a refunded payment was refunded, not just "Paid."', () => {
    expect(checkSummary({ status: "refunded", amount: 2_720_000, refunds: [refund(2_720_000, "processed")] })).toBe(
      "Up to date with Razorpay: ₹27,200 paid; all of it refunded."
    );
  });

  it("gives the part refunded, and what the bank has not confirmed", () => {
    expect(
      checkSummary({ status: "partially_refunded", amount: 920_000, refunds: [refund(870_000, "processed")] })
    ).toBe("Up to date with Razorpay: ₹9,200 paid; ₹8,700 refunded.");
    expect(checkSummary({ status: "refunded", amount: 920_000, refunds: [refund(920_000, "pending")] })).toBe(
      "Up to date with Razorpay: ₹9,200 paid; all of it being refunded (₹9,200 not yet confirmed by the bank)."
    );
  });

  it("ignores a failed refund, and leaves an unpaid payment to reconcile's own words", () => {
    expect(checkSummary({ status: "paid", amount: 920_000, refunds: [refund(920_000, "failed")] })).toBe(
      "Up to date with Razorpay: ₹9,200 paid."
    );
    expect(checkSummary({ status: "failed", amount: 920_000 })).toBeNull();
  });
});
