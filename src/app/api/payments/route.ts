import { getSession } from "@/lib/auth/session";
import { ok, fail } from "@/lib/api";
import { CheckoutInput } from "@/lib/payments/purposes";
import { startCheckout } from "@/lib/payments/service";
import { paymentError } from "@/lib/payments/http";

export const dynamic = "force-dynamic";

/**
 * Start paying for something: a session, a late fee, a clinic order, an
 * invoice. Checks it can be paid for and by whom, works out the amount here
 * (never from the request), and returns what Razorpay Checkout needs to open.
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return fail("Sign in to pay", 401);
    const input = CheckoutInput.parse(await req.json());
    const checkout = await startCheckout({ sub: session.sub, role: session.role }, input);
    return ok({ checkout }, { status: 201 });
  } catch (err) {
    return paymentError(err);
  }
}
