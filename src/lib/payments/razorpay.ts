import crypto from "node:crypto";
import { razorpayConfig, type RazorpayConfig } from "./config";

/**
 * The few Razorpay REST calls the app makes, over plain fetch.
 *
 * Not the official SDK, on purpose: it is five endpoints, the SDK would add a
 * dependency (and its HTTP client) to the server bundle, and a thin client is
 * easy to point at a local stand-in in tests. Amounts are always in paise, as
 * Razorpay takes them.
 *
 * Only reads are retried. A retried POST could create a second order or --
 * worse -- a second refund, so a POST that fails in transit is reported as
 * failed and left for the reconcile step to find out what actually happened.
 */

export type RzpOrder = {
  id: string;
  entity: "order";
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string | null;
  status: "created" | "attempted" | "paid";
  attempts: number;
  notes: Record<string, string> | [];
  created_at: number;
};

export type RzpPayment = {
  id: string;
  entity: "payment";
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  order_id: string | null;
  method: "card" | "netbanking" | "wallet" | "emi" | "upi" | "paylater" | "cardless_emi" | string;
  captured: boolean;
  amount_refunded: number;
  refund_status: "partial" | "full" | null;
  description?: string | null;
  email?: string | null;
  contact?: string | null;
  vpa?: string | null;
  bank?: string | null;
  wallet?: string | null;
  card_id?: string | null;
  card?: { network?: string | null; last4?: string | null; type?: string | null; issuer?: string | null } | null;
  fee?: number | null;
  tax?: number | null;
  error_code?: string | null;
  error_description?: string | null;
  error_reason?: string | null;
  error_source?: string | null;
  error_step?: string | null;
  created_at: number;
};

export type RzpRefund = {
  id: string;
  entity: "refund";
  amount: number;
  currency: string;
  payment_id: string;
  status: "pending" | "processed" | "failed";
  speed_requested?: string;
  speed_processed?: string;
  notes?: Record<string, string> | [];
  acquirer_data?: { arn?: string | null; rrn?: string | null } | null;
  created_at: number;
};

/** A refusal or failure from Razorpay, with its own words kept. */
export class RazorpayError extends Error {
  constructor(
    message: string,
    /** HTTP status; 0 when Razorpay could not be reached at all. */
    readonly status: number,
    readonly code: string,
    readonly reason: string | null = null
  ) {
    super(message);
    this.name = "RazorpayError";
  }
  /** The request may or may not have reached Razorpay: never assume either way. */
  get unreachable() {
    return this.status === 0;
  }
}

export class PaymentsNotConfigured extends Error {
  constructor() {
    super("Online payment is not set up yet.");
    this.name = "PaymentsNotConfigured";
  }
}

function requireConfig(cfg?: RazorpayConfig | null): RazorpayConfig {
  const c = cfg ?? razorpayConfig();
  if (!c) throw new PaymentsNotConfigured();
  return c;
}

const TIMEOUT_MS = 20_000;

async function call<T>(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>,
  cfg?: RazorpayConfig | null
): Promise<T> {
  const c = requireConfig(cfg);
  const auth = Buffer.from(`${c.keyId}:${c.keySecret}`).toString("base64");
  const attempts = method === "GET" ? 2 : 1;
  let last: unknown = null;

  for (let i = 0; i < attempts; i++) {
    let res: Response;
    try {
      res = await fetch(`${c.apiBase}${path}`, {
        method,
        headers: {
          authorization: `Basic ${auth}`,
          ...(body ? { "content-type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
    } catch (err) {
      last = err;
      continue;
    }

    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    if (res.ok) return json as T;

    const e = (json as { error?: { code?: string; description?: string; reason?: string } } | null)?.error;
    // A 5xx on a read is worth one more try; anything else is Razorpay's answer.
    if (method === "GET" && res.status >= 500 && i + 1 < attempts) {
      last = new RazorpayError(
        e?.description ?? `Razorpay answered ${res.status}`,
        res.status,
        e?.code ?? "SERVER_ERROR"
      );
      continue;
    }
    throw new RazorpayError(
      e?.description ?? `Razorpay answered ${res.status}`,
      res.status,
      e?.code ?? "UNKNOWN",
      e?.reason ?? null
    );
  }

  if (last instanceof RazorpayError) throw last;
  throw new RazorpayError("Could not reach Razorpay. Check the connection and try again.", 0, "NETWORK");
}

export const razorpay = {
  createOrder(input: { amount: number; currency?: string; receipt: string; notes?: Record<string, string> }) {
    return call<RzpOrder>("POST", "/orders", {
      amount: input.amount,
      currency: input.currency ?? "INR",
      receipt: input.receipt.slice(0, 40),
      notes: input.notes ?? {},
    });
  },
  fetchOrder(orderId: string) {
    return call<RzpOrder>("GET", `/orders/${encodeURIComponent(orderId)}`);
  },
  async fetchOrderPayments(orderId: string): Promise<RzpPayment[]> {
    const res = await call<{ items?: RzpPayment[] }>("GET", `/orders/${encodeURIComponent(orderId)}/payments`);
    return res?.items ?? [];
  },
  fetchPayment(paymentId: string) {
    return call<RzpPayment>("GET", `/payments/${encodeURIComponent(paymentId)}?expand[]=card`);
  },
  capture(paymentId: string, amount: number, currency = "INR") {
    return call<RzpPayment>("POST", `/payments/${encodeURIComponent(paymentId)}/capture`, { amount, currency });
  },
  refund(
    paymentId: string,
    input: { amount: number; speed?: "normal" | "optimum"; notes?: Record<string, string>; receipt?: string }
  ) {
    return call<RzpRefund>("POST", `/payments/${encodeURIComponent(paymentId)}/refund`, {
      amount: input.amount,
      speed: input.speed ?? requireConfig().refundSpeed,
      notes: input.notes ?? {},
      ...(input.receipt ? { receipt: input.receipt.slice(0, 40) } : {}),
    });
  },
  async listRefunds(paymentId: string): Promise<RzpRefund[]> {
    const res = await call<{ items?: RzpRefund[] }>("GET", `/payments/${encodeURIComponent(paymentId)}/refunds`);
    return res?.items ?? [];
  },
  fetchRefund(paymentId: string, refundId: string) {
    return call<RzpRefund>("GET", `/payments/${encodeURIComponent(paymentId)}/refunds/${encodeURIComponent(refundId)}`);
  },
};

/* ------------------------------------------------------------ signatures */

function hmacHex(secret: string, message: string): string {
  return crypto.createHmac("sha256", secret).update(message).digest("hex");
}

/** Constant-time, and false (never a throw) for anything malformed. */
function sameHex(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length || !/^[0-9a-f]+$/i.test(b)) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b.toLowerCase(), "hex"));
}

/**
 * What Checkout hands the browser after a payment: HMAC-SHA256 of
 * "<order_id>|<payment_id>" under the key secret. It proves the ids came from
 * Razorpay; it is not, on its own, proof the money was captured, which is why
 * the payment is also fetched before anything is applied.
 */
export function checkoutSignatureValid(
  input: { orderId: string; paymentId: string; signature: string },
  secret: string
): boolean {
  if (!input.orderId || !input.paymentId || !input.signature) return false;
  return sameHex(hmacHex(secret, `${input.orderId}|${input.paymentId}`), input.signature);
}

/** A webhook's X-Razorpay-Signature: HMAC-SHA256 of the raw body under the webhook secret. */
export function webhookSignatureValid(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  return sameHex(hmacHex(secret, rawBody), signature);
}
