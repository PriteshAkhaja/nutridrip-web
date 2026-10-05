import { fail, handleError } from "@/lib/api";
import { PaymentRefusal } from "./errors";
import { PaymentsNotConfigured, RazorpayError } from "./razorpay";

/** A payment route's error, in the envelope every route uses. */
export function paymentError(err: unknown) {
  if (err instanceof PaymentRefusal) return fail(err.message, err.status, err.extra);
  if (err instanceof PaymentsNotConfigured) {
    return fail("Online payment is not set up yet. Nothing was charged.", 503, { code: "payments_off" });
  }
  if (err instanceof RazorpayError) {
    console.error("[payments]", err);
    return fail(
      err.unreachable
        ? "Could not reach the payment service. Nothing has changed — try again in a moment."
        : `The payment service said: ${err.message}`,
      502
    );
  }
  return handleError(err);
}
