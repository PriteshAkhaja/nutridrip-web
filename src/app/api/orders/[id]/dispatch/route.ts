import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { dispatchOrder } from "@/lib/inventory/dispatch";
import { notify } from "@/lib/notify";
import { ok, fail, handleError } from "@/lib/api";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "orders.dispatch")) return fail("Not permitted", 403);
    const { id } = await params;
    const order = await dispatchOrder(id, session!.sub);
    await notify(
      order.clinicId ? String(order.clinicId) : String(order.orderedBy),
      "Your order has been dispatched",
      `${order.orderNo} · Batch numbers are on the order for your records.`,
      "success",
      "/clinic/orders"
    );

    return ok({ order });
  } catch (err) {
    return handleError(err);
  }
}
