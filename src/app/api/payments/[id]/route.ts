import { connectDB } from "@/lib/db/mongoose";
import { Payment } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { ok, fail } from "@/lib/api";
import { reconcile, toView, type PaymentDoc } from "@/lib/payments/service";
import { paymentError } from "@/lib/payments/http";

export const dynamic = "force-dynamic";

/**
 * Where one payment stands -- for the payer's "confirming your payment" screen
 * and the admin's ledger. A payment not yet settled is checked with Razorpay
 * on the way, so a browser that lost the confirmation still finds out.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return fail("Sign in", 401);
    const { id } = await params;
    await connectDB();
    const p = await Payment.findById(id).lean<{
      payerId: unknown;
      status: string;
      apply?: { state?: string };
      createdAt?: Date;
    } | null>();
    if (!p) return fail("Payment not found", 404);
    if (String(p.payerId) !== session.sub && !can(session.role, "payments.view")) return fail("Not permitted", 403);

    const unsettled = p.status === "created" || p.status === "failed" || p.apply?.state === "pending";
    const result = unsettled ? await reconcile(id).catch(() => null) : null;
    const fresh = await Payment.findById(id).lean<PaymentDoc>();
    if (!fresh) return fail("Payment not found", 404);
    return ok({ payment: toView(fresh), result });
  } catch (err) {
    return paymentError(err);
  }
}
