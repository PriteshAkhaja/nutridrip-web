import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Order } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { cancelOrder } from "@/lib/inventory/dispatch";
import { notify } from "@/lib/notify";
import { ok, fail, handleError } from "@/lib/api";

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
      .lean<{ status: string; amount?: number; payment?: { state?: string } } | null>();
    const wasConfirmed = order0?.status === "CONFIRMED";
    const order = await cancelOrder(id, body?.reason, session!.sub);
    // Paid for and now not happening: the clinic is owed its money back.
    const refundDue = order0?.payment?.state === "received";
    if (refundDue) await Order.updateOne({ _id: id }, { $set: { "payment.refundDue": true } });
    await notify(
      order.clinicId ? String(order.clinicId) : String(order.orderedBy),
      "Your order was cancelled",
      // A draft never held anything, so saying stock was released would be a
      // claim about the shelf that never happened.
      `${order.orderNo}${wasConfirmed ? " · The reserved stock has been released." : ""}${
        refundDue ? ` · Your payment of ₹${(order0?.amount ?? 0).toLocaleString("en-IN")} is due back to you.` : ""
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
