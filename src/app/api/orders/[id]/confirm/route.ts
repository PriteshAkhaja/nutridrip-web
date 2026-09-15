import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { confirmOrder } from "@/lib/inventory/dispatch";
import { notify } from "@/lib/notify";
import { ok, fail, handleError } from "@/lib/api";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "orders.update")) return fail("Not permitted", 403);
    const { id } = await params;
    const order = await confirmOrder(id, session!.sub);
    await notify(
      order.clinicId ? String(order.clinicId) : String(order.orderedBy),
      "Your order is confirmed",
      `${order.orderNo} · Stock is reserved against it. Nothing else can claim those vials.`,
      "success",
      "/clinic/orders"
    );

    return ok({ order });
  } catch (err) {
    return handleError(err);
  }
}
