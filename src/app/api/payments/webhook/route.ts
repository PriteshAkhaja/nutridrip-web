import { NextResponse } from "next/server";
import { razorpayConfig } from "@/lib/payments/config";
import { webhookSignatureValid } from "@/lib/payments/razorpay";
import { handleWebhookEvent } from "@/lib/payments/service";

export const dynamic = "force-dynamic";

/**
 * Razorpay's webhook: payments captured or failed, refunds processed or failed.
 *
 * The raw body is read as text before anything else, because the signature is
 * over those exact bytes. A bad signature is refused; an event for something
 * that is not ours is acknowledged and ignored; the same event twice is a
 * no-op. Only an error worth retrying (the database was down) answers 500,
 * which makes Razorpay send it again.
 *
 * Set up in the Razorpay dashboard: Settings → Webhooks → Add, URL
 * https://<your domain>/api/payments/webhook, a secret (RAZORPAY_WEBHOOK_SECRET),
 * and the events payment.captured, payment.failed, order.paid,
 * refund.processed and refund.failed.
 */
export async function POST(req: Request) {
  const cfg = razorpayConfig();
  if (!cfg?.webhookSecret) {
    return NextResponse.json({ ok: false, error: "Webhook not configured" }, { status: 503 });
  }
  const raw = await req.text();
  if (!webhookSignatureValid(raw, req.headers.get("x-razorpay-signature"), cfg.webhookSecret)) {
    return NextResponse.json({ ok: false, error: "Bad signature" }, { status: 401 });
  }

  let event: Parameters<typeof handleWebhookEvent>[1];
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "Not JSON" }, { status: 400 });
  }

  try {
    const outcome = await handleWebhookEvent(req.headers.get("x-razorpay-event-id"), event);
    return NextResponse.json({ ok: true, outcome });
  } catch (err) {
    console.error("[payments] webhook:", err);
    return NextResponse.json({ ok: false, error: "Try again" }, { status: 500 });
  }
}
