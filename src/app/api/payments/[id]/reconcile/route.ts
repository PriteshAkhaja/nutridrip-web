import { connectDB } from "@/lib/db/mongoose";
import { Payment } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { ok, fail } from "@/lib/api";
import { reconcile, toView, type PaymentDoc } from "@/lib/payments/service";
import { paymentError } from "@/lib/payments/http";
import { checkSummary } from "@/lib/payments/rules";

export const dynamic = "force-dynamic";

/** "Check with Razorpay": make the record say what Razorpay says. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "payments.view")) return fail("Not permitted", 403);
    const { id } = await params;
    await connectDB();
    const result = await reconcile(id);
    const p = await Payment.findById(id).lean<PaymentDoc>();
    if (!p) return fail("Payment not found", 404);
    // Said for the team, from the record as it now stands; a payment that went
    // wrong keeps the explanation reconcile gave.
    return ok({ result: { ...result, message: checkSummary(p) ?? result.message }, payment: toView(p) });
  } catch (err) {
    return paymentError(err);
  }
}
