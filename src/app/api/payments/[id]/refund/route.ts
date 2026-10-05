import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { Payment } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { ok, fail } from "@/lib/api";
import { refundPayment, type RefundOutcome } from "@/lib/payments/refunds";
import { owedOnPayment, syncBookingMoney, syncOrderMoney } from "@/lib/payments/money";
import { toView, type PaymentDoc } from "@/lib/payments/service";
import { paymentError } from "@/lib/payments/http";
import { notify } from "@/lib/notify";
import { inrFromPaise, refundEta, refundedOf, toPaise } from "@/lib/payments/rules";

export const dynamic = "force-dynamic";

const Input = z.object({
  /** Rupees; left out, everything not yet refunded goes back. */
  amount: z.number().positive().max(10_000_000).optional(),
  reason: z.string().trim().min(3, "Say why").max(300),
});

/**
 * A refund made by hand: a complaint, a goodwill gesture, or the retry of one
 * that failed. The refunds a rule calls for happen by themselves.
 *
 * Whatever of it the rules already owe back -- a cancellation's refund that
 * failed at the bank, say -- is recorded as that refund, retried; only the
 * rest is goodwill. Recorded all as goodwill, the rules would still think the
 * first refund owed and send it again.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "payments.refund")) return fail("Not permitted", 403);
    const { id } = await params;
    const input = Input.parse(await req.json());
    await connectDB();

    // More than is left is a mistake to say out loud, not to quietly cap.
    const current = await Payment.findById(id).lean<PaymentDoc>();
    if (!current) return fail("Payment not found", 404);
    const room = current.amount - refundedOf(current.refunds);
    if (input.amount && toPaise(input.amount) > room) {
      return fail(`At most ${inrFromPaise(room)} can still be refunded on this payment.`, 422);
    }
    const wanted = input.amount ? toPaise(input.amount) : room;
    if (wanted <= 0) return fail("Everything on this payment has already been refunded.", 409);

    const owed = await owedOnPayment(id);
    const retry = owed ? Math.min(owed.amount, wanted) : 0;
    const outcomes: RefundOutcome[] = [];
    if (owed && retry > 0) {
      outcomes.push(
        await refundPayment(id, {
          amount: retry,
          kind: owed.kind,
          reason: `${owed.reason} — sent again by hand: ${input.reason}`,
          byId: session!.sub,
        })
      );
    }
    // Only if the retry went (a failed one would otherwise be sent again as goodwill).
    if (wanted > retry && outcomes.every((o) => o.status !== "failed")) {
      outcomes.push(
        await refundPayment(id, { amount: wanted - retry, kind: "manual", reason: input.reason, byId: session!.sub })
      );
    }
    const sent = outcomes.filter((o) => o.status === "pending" || o.status === "processed");
    const failed = outcomes.find((o) => o.status === "failed");
    if (!sent.length && !failed) return fail("Everything on this payment has already been refunded.", 409);
    const outcome: RefundOutcome = failed
      ? { ...failed, amount: sent.reduce((n, o) => n + o.amount, 0) + failed.amount }
      : { status: sent.at(-1)!.status, amount: sent.reduce((n, o) => n + o.amount, 0), speed: sent[0]?.speed };

    const p = await Payment.findById(id).lean<PaymentDoc>();
    if (!p) return fail("Payment not found", 404);
    // The session's or order's own status follows the money.
    if (p.bookingId) await syncBookingMoney(String(p.bookingId), { refund: false });
    if (p.orderId && p.purpose === "order") await syncOrderMoney(String(p.orderId), { refund: false });
    const back = sent.reduce((n, o) => n + o.amount, 0);
    if (back > 0) {
      await notify(
        String(p.payerId),
        `Refund on its way · ${p.receiptNo}`,
        `${inrFromPaise(back)} is going back to the account you paid from — ${refundEta(sent[0]?.speed)}.`,
        "success",
        p.payerRole === "clinic" ? "/clinic" : "/app/sessions"
      );
    }
    return ok({ outcome, payment: toView(p) });
  } catch (err) {
    return paymentError(err);
  }
}
