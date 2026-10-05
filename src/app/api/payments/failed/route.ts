import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { ok, fail } from "@/lib/api";
import { recordFailure } from "@/lib/payments/service";
import { paymentError } from "@/lib/payments/http";

export const dynamic = "force-dynamic";

const Input = z.object({
  razorpay_order_id: z.string().min(1).max(64),
  error: z
    .object({
      code: z.string().max(80).optional(),
      description: z.string().max(500).optional(),
      reason: z.string().max(80).optional(),
      source: z.string().max(40).optional(),
      step: z.string().max(60).optional(),
      paymentId: z.string().max(64).optional(),
    })
    .default({}),
});

/**
 * Checkout's failure callback. Kept for the payer and the team, and answered
 * with what to tell the payer. It changes nothing about the money: only
 * Razorpay's own word marks a payment failed or paid.
 */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session) return fail("Sign in", 401);
    const { razorpay_order_id, error } = Input.parse(await req.json());
    const message = await recordFailure({ sub: session.sub, role: session.role }, razorpay_order_id, error);
    return ok({ message });
  } catch (err) {
    return paymentError(err);
  }
}
