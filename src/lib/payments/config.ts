/**
 * Razorpay settings, read from the environment every time they are asked for.
 *
 * Without a key id and secret, online payment is simply off: the app runs as it
 * always has, bookings are made without paying, and every "Pay" button is
 * replaced by a plain explanation. Nothing half-works.
 *
 * The key id is public -- it is handed to the browser to open Checkout -- and is
 * returned by the API with each checkout, so it needs no NEXT_PUBLIC_ copy. The
 * key secret and the webhook secret never leave the server.
 */
export type RazorpayConfig = {
  keyId: string;
  keySecret: string;
  /** Signs the webhooks Razorpay sends. Optional: without it the webhook route refuses everything. */
  webhookSecret: string | null;
  apiBase: string;
  mode: "test" | "live";
  /**
   * "normal" refunds reach the customer in 5–7 working days at no cost.
   * "optimum" asks Razorpay for an instant refund where the bank supports it
   * (charged per refund by Razorpay) and falls back to normal otherwise.
   */
  refundSpeed: "normal" | "optimum";
};

const DEFAULT_API = "https://api.razorpay.com/v1";

/**
 * The API base may be pointed at a local stand-in for tests, and only at one on
 * this machine. An override that could name any host would be a way to send the
 * key secret somewhere else.
 */
export function apiBaseFrom(raw: string | undefined): string {
  const value = raw?.trim();
  if (!value) return DEFAULT_API;
  try {
    const url = new URL(value);
    if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return value.replace(/\/+$/, "");
  } catch {
    // fall through to the real API
  }
  return DEFAULT_API;
}

export function razorpayConfig(env: Record<string, string | undefined> = process.env): RazorpayConfig | null {
  const keyId = env.RAZORPAY_KEY_ID?.trim();
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) return null;
  return {
    keyId,
    keySecret,
    webhookSecret: env.RAZORPAY_WEBHOOK_SECRET?.trim() || null,
    apiBase: apiBaseFrom(env.RAZORPAY_API_BASE),
    mode: keyId.startsWith("rzp_live_") ? "live" : "test",
    refundSpeed: env.RAZORPAY_REFUND_SPEED?.trim() === "optimum" ? "optimum" : "normal",
  };
}

export function paymentsEnabled(): boolean {
  return razorpayConfig() !== null;
}

/** What the settings screen may show about the setup. Never the secrets. */
export function paymentsSetup(): {
  enabled: boolean;
  mode: "test" | "live" | null;
  webhook: boolean;
  keyIdTail: string | null;
  refundSpeed: "normal" | "optimum";
} {
  const cfg = razorpayConfig();
  return {
    enabled: Boolean(cfg),
    mode: cfg?.mode ?? null,
    webhook: Boolean(cfg?.webhookSecret),
    keyIdTail: cfg ? cfg.keyId.slice(-4) : null,
    refundSpeed: cfg?.refundSpeed ?? "normal",
  };
}
