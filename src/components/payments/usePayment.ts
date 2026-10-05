"use client";

import { useCallback, useRef, useState } from "react";
import { loadCheckout, openCheckout, type CheckoutError, type CheckoutOptions } from "./checkout";

/**
 * Paying, as a small state machine the button and the sheet both read.
 *
 *   idle        nothing happening (or a closed Checkout, with `notice` saying so)
 *   starting    asking the server to open a checkout -- the button spins
 *   open        Razorpay Checkout is on screen
 *   confirming  paid in Checkout; the server is checking it with Razorpay
 *   done        paid and applied -- booked, moved, paid
 *   refunded    paid, but it could not be done, so it went straight back
 *   pending     paid in Checkout, not yet confirmed -- the bank is slow; it
 *               settles on its own and the person is notified
 *   failed      Razorpay or the server says the payment itself failed
 *
 * A refusal before Checkout opens -- the slot went, payment is switched off --
 * is not a failed payment: nobody paid anything. It comes back as `refusal`
 * with the phase idle, for the screen to show beside the button.
 */
export type PayPhase = "idle" | "starting" | "open" | "confirming" | "done" | "refunded" | "pending" | "failed";

/** What the receipt on the success screen shows. Paise. */
export type PayReceipt = {
  amount: number;
  refunded: number;
  methodLabel: string | null;
  paidAt: string | null;
  purposeLabel: string;
  description: string | null;
};

export type PayState = {
  phase: PayPhase;
  /** What to tell the person, in the phase they are in. */
  message: string | null;
  /** A gentle note under the button after Checkout closed without paying. */
  notice: { tone: "info" | "caution"; text: string } | null;
  receiptNo: string | null;
  receipt: PayReceipt | null;
  returnTo: string | null;
  bookingId: string | null;
  /** The server's code for a refusal, e.g. "payments_off". */
  code: string | null;
  /** Refused before any money moved, with the server's reason and status. */
  refusal: { message: string; status: number; code: string | null } | null;
};

const INITIAL: PayState = {
  phase: "idle",
  message: null,
  notice: null,
  receiptNo: null,
  receipt: null,
  returnTo: null,
  bookingId: null,
  code: null,
  refusal: null,
};

type ServerCheckout = CheckoutOptions & {
  paymentId: string;
  receiptNo: string;
  returnTo: string;
  mode: "test" | "live";
};
type ServerResult = {
  status: "paid" | "processing" | "pending" | "failed" | "refunded";
  applied: boolean;
  message: string;
  receiptNo: string;
  bookingId?: string;
  returnTo?: string;
  receipt?: PayReceipt;
};
type ServerView = {
  status?: string;
  applyState?: string | null;
  amount?: number;
  refunded?: number;
  methodLabel?: string | null;
  paidAt?: string | null;
  purposeLabel?: string;
  lastFailure?: string | null;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postJson(url: string, body: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, json };
}

async function look(paymentId: string): Promise<{ result: ServerResult | null; view: ServerView | null }> {
  const res = await fetch(`/api/payments/${paymentId}`, { cache: "no-store" });
  const json = await res.json();
  return { result: (json?.data?.result as ServerResult) ?? null, view: (json?.data?.payment as ServerView) ?? null };
}

function receiptFromView(view: ServerView | null, checkout: ServerCheckout): PayReceipt {
  return {
    amount: view?.amount ?? checkout.amount,
    refunded: view?.refunded ?? 0,
    methodLabel: view?.methodLabel ?? null,
    paidAt: view?.paidAt ?? null,
    purposeLabel: view?.purposeLabel ?? "Payment",
    description: checkout.description ?? null,
  };
}

export function usePayment() {
  const [state, setState] = useState<PayState>(INITIAL);
  // One payment at a time per button, whatever the fingers do.
  const busy = useRef(false);

  const reset = useCallback(() => setState(INITIAL), []);

  const settleFromServer = useCallback((result: ServerResult, checkout: ServerCheckout, view: ServerView | null) => {
    const base = {
      ...INITIAL,
      receiptNo: result.receiptNo ?? checkout.receiptNo,
      receipt: result.receipt ?? receiptFromView(view, checkout),
      returnTo: result.returnTo ?? checkout.returnTo,
      bookingId: result.bookingId ?? null,
    };
    if (result.status === "paid") setState({ ...base, phase: "done", message: result.message });
    else if (result.status === "refunded") setState({ ...base, phase: "refunded", message: result.message });
    else if (result.status === "failed") setState({ ...base, phase: "failed", message: result.message });
    else
      setState({
        ...base,
        phase: "pending",
        message:
          "Your bank has not confirmed it yet. There is no need to pay again — it settles on its own, and you will get a notification either way. If it does not go through, any money taken is returned automatically.",
      });
  }, []);

  /** After Checkout says paid: confirm with the server, retrying a lost connection, then poll if the bank is slow. */
  const confirm = useCallback(
    async (checkout: ServerCheckout, response: Record<string, string>) => {
      setState((s) => ({ ...s, phase: "confirming", message: null, notice: null }));
      let result: ServerResult | null = null;
      let view: ServerView | null = null;
      for (let attempt = 0; attempt < 3 && !result; attempt++) {
        try {
          const { json } = await postJson("/api/payments/confirm", response);
          if (json.success) result = (json.data as { result: ServerResult }).result;
          else break; // the server's own answer: fall through to polling, which asks Razorpay directly
        } catch {
          await sleep(1200 * (attempt + 1));
        }
      }
      // Slow bank, lost connection, or a confirmation that could not be read:
      // ask the server (which asks Razorpay) a few more times.
      for (let i = 0; i < 12 && (!result || result.status === "processing" || result.status === "pending"); i++) {
        await sleep(i < 4 ? 1500 : 3000);
        try {
          const seen = await look(checkout.paymentId);
          view = seen.view ?? view;
          if (seen.result) result = seen.result;
          else if (view?.applyState === "applied") {
            result = { status: "paid", applied: true, message: "Paid.", receiptNo: checkout.receiptNo };
          } else if (view?.applyState === "failed") {
            result = {
              status: "refunded",
              applied: false,
              message: "It could not be completed, so your payment is being refunded.",
              receiptNo: checkout.receiptNo,
            };
          }
        } catch {
          // keep trying
        }
      }
      settleFromServer(
        result ?? { status: "pending", applied: false, message: "", receiptNo: checkout.receiptNo },
        checkout,
        view
      );
    },
    [settleFromServer]
  );

  const pay = useCallback(
    async (body: Record<string, unknown>) => {
      if (busy.current) return;
      busy.current = true;
      setState({ ...INITIAL, phase: "starting" });
      try {
        let checkout: ServerCheckout;
        try {
          const { status, json } = await postJson("/api/payments", body);
          if (!json.success) {
            setState({
              ...INITIAL,
              refusal: {
                message: (json.error as string) ?? "The payment could not be started. Nothing was charged.",
                status,
                code: (json.code as string) ?? null,
              },
            });
            return;
          }
          checkout = (json.data as { checkout: ServerCheckout }).checkout;
        } catch {
          setState({
            ...INITIAL,
            refusal: {
              message: "Could not reach the server. Nothing was charged — check your connection and try again.",
              status: 0,
              code: "network",
            },
          });
          return;
        }

        try {
          await loadCheckout();
        } catch (err) {
          setState({ ...INITIAL, refusal: { message: (err as Error).message, status: 0, code: "checkout_load" } });
          return;
        }

        setState((s) => ({ ...s, phase: "open" }));
        const outcome = await openCheckout(checkout, (error: CheckoutError) => {
          // Kept for the team; Checkout stays open for another try.
          void postJson("/api/payments/failed", {
            razorpay_order_id: checkout.orderId,
            error: {
              code: error.code,
              description: error.description,
              reason: error.reason,
              source: error.source,
              step: error.step,
              paymentId: error.metadata?.payment_id,
            },
          }).catch(() => {});
        });

        if (outcome.kind === "paid") {
          await confirm(checkout, outcome.response);
          return;
        }

        // Closed without paying. It may still have been paid in the last
        // second (a UPI app approving after the window closed), so ask once.
        let failure: string | null = null;
        try {
          const seen = await look(checkout.paymentId);
          if (seen.result && (seen.result.status === "paid" || seen.result.status === "refunded")) {
            settleFromServer(seen.result, checkout, seen.view);
            return;
          }
          failure = seen.view?.lastFailure ?? null;
        } catch {
          // fall through to the plain notice
        }
        setState({
          ...INITIAL,
          notice:
            outcome.lastError || failure
              ? {
                  tone: "caution",
                  text: failure ?? "The payment did not go through. No money was taken — you can try again.",
                }
              : { tone: "info", text: "Payment cancelled. Nothing was charged." },
        });
      } finally {
        busy.current = false;
      }
    },
    [confirm, settleFromServer]
  );

  return { state, pay, reset };
}
