import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { ok, fail } from "@/lib/api";
import { confirmCheckout } from "@/lib/payments/service";
import { paymentError } from "@/lib/payments/http";

export const dynamic = "force-dynamic";

const Input = z.object({
  razorpay_order_id: z.string().min(1).max(64),
  razorpay_payment_id: z.string().min(1).max(64),
  razorpay_signature: z.string().min(1).max(256),
});

/**
 * Checkout's success callback, passed on by the browser. The signature is
 * checked and the payment fetched from Razorpay before anything is done with
 * it; the answer says what happened -- booked, moved, paid -- or that it could
 * not be done and has been refunded.
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return fail("Sign in", 401);
    const body = Input.parse(await req.json());
    const result = await confirmCheckout({ sub: session.sub, role: session.role }, body);
    return ok({ result });
  } catch (err) {
    return paymentError(err);
  }
}
