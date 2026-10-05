"use client";

/**
 * Razorpay Checkout in the browser: load its script once, on demand, and turn
 * its callbacks into one promise.
 *
 * The script is only fetched when somebody presses Pay -- no page carries it
 * otherwise, so it costs nothing to the pages that never take money.
 */

const SRC = "https://checkout.razorpay.com/v1/checkout.js";
const LOAD_TIMEOUT_MS = 15_000;

/**
 * The logo Checkout shows, and the bank page Razorpay opens after it: the brand
 * mark (src/app/apple-icon.png, 180 x 180) embedded as base64, which Razorpay
 * accepts in place of a link. A link fails on Razorpay's own https pages
 * wherever the site itself is not public https (localhost, a preview), and
 * Checkout does not reliably draw SVG. Regenerate it if the mark changes.
 */
const CHECKOUT_LOGO =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALQAAAC0CAIAAACyr5FlAAABWElEQVR42u3SMQ0AIAwAwc64RAlaUIAKnKCBiQED3QnJJafg87H2gVRIgDkwB+bAHJgDc2AOzIE5MAeYA3NgDsyBOTAH5sAcmANzgDkwB+bAHJgDc2AOzIE5MAeYA3NgDsyBOTAH5sAcmANzYA4wB+bAHJgDc2AOzIE5MAfmAHNgDsyBOTAH5sAcmANzYA4wB+bAHJgDc/B4jjompKK0DilzYA7MgTkwB+bAHJgDc2AOzAHmwByYA3NgDsyBOTAH5sAcYA7MgTkwB+bAHJgDc2AOzAHmwByYA3NgDsyBOTAH5sAcmAPMgTkwB+bAHJgDc2AOzIE5wByYA3NgDsyBOTAH5sAcmAPMgTkwB+bAHJgDc2AOzIE5MAeYA3NgDsyBOTAH5sAcmANzgDkwB+bAHJgDc2AOzIE5MAeYA3NgDsyBOTAH5sAcmANzYA4wB+bAHJgDc2AO/nEBGjnI6h1LibgAAAAASUVORK5CYII=";

export type CheckoutSuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

export type CheckoutError = {
  code?: string;
  description?: string;
  source?: string;
  step?: string;
  reason?: string;
  metadata?: { order_id?: string; payment_id?: string };
};

type RazorpayInstance = {
  open: () => void;
  close: () => void;
  on: (event: "payment.failed", cb: (resp: { error: CheckoutError }) => void) => void;
};

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

let loading: Promise<void> | null = null;

export function loadCheckout(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("Not in a browser"));
  if (window.Razorpay) return Promise.resolve();
  if (loading) return loading;

  loading = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    const script = existing ?? document.createElement("script");
    const timer = window.setTimeout(() => fail(), LOAD_TIMEOUT_MS);
    function fail() {
      window.clearTimeout(timer);
      loading = null;
      script.remove();
      reject(
        new Error("The payment window could not load. Check your connection and try again — nothing was charged.")
      );
    }
    script.addEventListener("load", () => {
      window.clearTimeout(timer);
      if (window.Razorpay) resolve();
      else fail();
    });
    script.addEventListener("error", fail);
    if (!existing) {
      script.src = SRC;
      script.async = true;
      document.head.appendChild(script);
    }
  });
  return loading;
}

export type CheckoutOptions = {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name?: string; email?: string; contact?: string };
  notes: Record<string, string>;
};

export type CheckoutOutcome =
  | { kind: "paid"; response: CheckoutSuccess }
  /** Closed without paying; `lastError` when an attempt failed before that. */
  | { kind: "dismissed"; lastError: CheckoutError | null };

/** The brand colour, read from the page so Checkout matches whatever the tokens say. */
function brandColour(): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--color-primary").trim();
  return /^#[0-9a-f]{3,8}$/i.test(v) ? v : "#0a7fa1";
}

/**
 * Open Checkout and wait. A failed attempt does not end it: Checkout stays open
 * so the person can try another way, and each failure is reported through
 * `onAttemptFailed` as it happens.
 */
export function openCheckout(
  options: CheckoutOptions,
  onAttemptFailed?: (error: CheckoutError) => void
): Promise<CheckoutOutcome> {
  return new Promise((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error("The payment window is not loaded."));
      return;
    }
    let settled = false;
    let lastError: CheckoutError | null = null;
    const done = (outcome: CheckoutOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };

    const rzp = new window.Razorpay({
      key: options.keyId,
      order_id: options.orderId,
      amount: options.amount,
      currency: options.currency,
      name: options.name,
      description: options.description,
      image: CHECKOUT_LOGO,
      prefill: options.prefill,
      notes: options.notes,
      theme: { color: brandColour() },
      retry: { enabled: true, max_count: 4 },
      // Checkout closes itself after 15 minutes; the order stays payable.
      timeout: 900,
      remember_customer: false,
      modal: {
        escape: true,
        backdropclose: false,
        // Asks "are you sure?" before closing mid-payment.
        confirm_close: true,
        animation: true,
        ondismiss: () => done({ kind: "dismissed", lastError }),
      },
      handler: (response: CheckoutSuccess) => done({ kind: "paid", response }),
    });
    rzp.on("payment.failed", (resp) => {
      lastError = resp?.error ?? null;
      if (lastError) onAttemptFailed?.(lastError);
    });
    rzp.open();
  });
}
