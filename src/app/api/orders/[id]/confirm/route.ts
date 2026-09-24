import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { AuditLog, Order, User } from "@/lib/models";
import { connectDB } from "@/lib/db/mongoose";
import { confirmBlockedBy } from "@/lib/billing/order-payment";
import { confirmOrder } from "@/lib/inventory/dispatch";
import { notify } from "@/lib/notify";
import { ok, fail, handleError } from "@/lib/api";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "orders.update")) return fail("Not permitted", 403);
    const { id } = await params;

    // A clinic that pays first must have paid: the pharmacy never prepares an
    // order nobody has paid for. Received is final, so checking here, before
    // the stock is reserved, cannot be overtaken.
    await connectDB();
    const pending = await Order.findById(id)
      .select("status clinicId onCredit payment")
      .lean<{
        status: string;
        clinicId?: unknown;
        onCredit?: boolean;
        payment?: { state: "awaiting" | "submitted" | "received" };
      } | null>();
    if (pending?.clinicId) {
      const clinic = await User.findById(pending.clinicId)
        .select("clinic.onCredit")
        .lean<{ clinic?: { onCredit?: boolean } } | null>();
      const blocked = confirmBlockedBy(pending, clinic?.clinic?.onCredit ?? false);
      if (blocked) return fail(blocked, 409);
    }

    const order = await confirmOrder(id, session!.sub);
    await notify(
      order.clinicId ? String(order.clinicId) : String(order.orderedBy),
      "Your order is confirmed",
      `${order.orderNo} · Stock is reserved against it. Nothing else can claim those vials.`,
      "success",
      "/clinic/orders"
    );

    /**
     * Stock reserved against this order. The stock ledger records the movement; this records the decision —
     * who pressed it, and when. A recall is answered from the ledger; "who
     * dispatched this" is answered from here.
     */
    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "order.confirm",
      entity: "Order",
      entityId: id,
      after: { orderNo: order.orderNo, status: order.status, amount: order.amount },
    });

    return ok({ order });
  } catch (err) {
    return handleError(err);
  }
}
