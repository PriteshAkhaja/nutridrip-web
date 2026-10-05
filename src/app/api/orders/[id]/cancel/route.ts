import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Order } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { cancelOrder } from "@/lib/inventory/dispatch";
import { notify } from "@/lib/notify";
import { ok, fail, handleError } from "@/lib/api";
import { syncOrderMoney } from "@/lib/payments/money";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "orders.update")) return fail("Not permitted", 403);
    const { id } = await params;
    await connectDB();
    const body = await req.json().catch(() => ({}));
    // Read before cancelling, so the notification can say what actually happened.
    const order0 = await Order.findById(id)
      .select("status payment amount")
      .lean<{ status: string; amount?: number; payment?: { state?: string; method?: string } } | null>();
    const wasConfirmed = order0?.status === "CONFIRMED";
    const order = await cancelOrder(id, body?.reason, session!.sub);
    // Paid for and now not happening: the clinic is owed its money back.
    // Paid online, it goes back through Razorpay now; paid by transfer, the
    // team sends it back the way it came, and the order says it is due.
    //
    // Read again after cancelling: an online payment can land between the
    // first read and the cancel, and its money must not be missed.
    const after = await Order.findById(id)
      .select("payment")
      .lean<{ payment?: { state?: string; method?: string } } | null>();
    const refundDue = after?.payment?.state === "received";
    const online = refundDue && after?.payment?.method === "online";
    if (refundDue) await Order.updateOne({ _id: id }, { $set: { "payment.refundDue": true } });
    // Always: a payment captured for this order in the same moment it was
    // cancelled is refunded here too (its own apply refuses a cancelled order).
    const money = await syncOrderMoney(id, { byId: session!.sub }).catch((err) => {
      console.error("[order cancel] refund:", err);
      return null;
    });
    await notify(
      order.clinicId ? String(order.clinicId) : String(order.orderedBy),
      "Your order was cancelled",
      // A draft never held anything, so saying stock was released would be a
      // claim about the shelf that never happened.
      `${order.orderNo}${wasConfirmed ? " · The reserved stock has been released." : ""}${
        refundDue
          ? online && money?.refunded
            ? ` · Your payment of ₹${(order0?.amount ?? 0).toLocaleString("en-IN")} is being refunded to the account you paid from.`
            : ` · Your payment of ₹${(order0?.amount ?? 0).toLocaleString("en-IN")} is due back to you.`
          : ""
      }`,
      "warning",
      "/clinic/orders"
    );

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "order.cancel",
      entity: "Order",
      entityId: id,
      before: { status: order0?.status },
      after: {
        orderNo: order.orderNo,
        status: order.status,
        reason: body?.reason ?? "—",
        ...(refundDue ? { refundDue: true } : {}),
      },
    });

    return ok({ order });
  } catch (err) {
    return handleError(err);
  }
}
