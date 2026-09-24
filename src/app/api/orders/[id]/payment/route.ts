import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Order, User } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { notify, notifyRole } from "@/lib/notify";
import { inr } from "@/lib/billing/late-policy";
import { PAY_METHODS, PAY_METHOD_LABEL, needsPayment, referenceProblem } from "@/lib/billing/order-payment";
import { ok, fail, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

const Input = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("submit"),
    method: z.enum(PAY_METHODS),
    reference: z.string().trim().max(40),
    /** The day the money was sent, YYYY-MM-DD. */
    paidOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the date it was paid"),
  }),
  z.object({ action: z.literal("received") }),
  z.object({ action: z.literal("not_received"), note: z.string().trim().min(3, "Say what was not found").max(300) }),
]);

type Pay = {
  state?: "awaiting" | "submitted" | "received";
  method?: string;
  reference?: string;
  paidOn?: Date;
  submittedAt?: Date;
  submittedBy?: unknown;
  verifiedAt?: Date;
  verifiedBy?: unknown;
  note?: string;
  refundDue?: boolean;
};

/**
 * A clinic's payment for an order: the clinic records it, the team checks it.
 *
 *   submit        the clinic (or the team for them): method, reference, date
 *   received      the team found the money -- the order can now be confirmed
 *   not_received  the team could not find it -- back to the clinic, with why
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session) return fail("Sign in", 401);
    const { id } = await params;
    const input = Input.parse(await req.json());
    await connectDB();

    if (!Order.schema.path("payment.state")) {
      return fail(
        "The server is running an older version and would not keep this. Restart it (stop it and run npm run dev again).",
        500
      );
    }

    const order = await Order.findById(id);
    if (!order) return fail("Order not found", 404);
    const ownClinic = session.role === "clinic" && String(order.clinicId) === session.sub;
    const staff = can(session.role, "orders.update");
    if (!ownClinic && !staff) return fail("Not permitted", 403);

    const clinic = order.clinicId
      ? await User.findById(order.clinicId)
          .select("name clinic.onCredit")
          .lean<{ name: string; clinic?: { onCredit?: boolean } } | null>()
      : null;
    if (!needsPayment(order, clinic?.clinic?.onCredit ?? false)) return fail("This order does not need paying first", 409);
    if (order.status !== "DRAFT") return fail("This order has moved on; its payment can no longer be changed", 409);

    const current: Pay = order.payment?.state ? (order.payment.toObject?.() ?? order.payment) : { state: "awaiting" };
    const before = { state: current.state ?? "awaiting", method: current.method ?? null, reference: current.reference ?? null };

    let next: Pay;
    if (input.action === "submit") {
      if (current.state === "received") return fail("This payment has already been received", 409);
      const problem = referenceProblem(input.reference);
      if (problem) return fail(problem, 422);
      const paidOn = new Date(`${input.paidOn}T00:00:00+05:30`);
      if (paidOn.getTime() > Date.now() + 86_400_000) return fail("The payment date cannot be in the future", 422);
      next = {
        state: "submitted",
        method: input.method,
        reference: input.reference.trim(),
        paidOn,
        submittedAt: new Date(),
        submittedBy: session.sub,
      };
    } else {
      if (!staff) return fail("Only the NutriDrip team can check a payment", 403);
      if (current.state !== "submitted") return fail("Nothing to check yet: the clinic has not recorded a payment", 409);
      next =
        input.action === "received"
          ? { ...current, state: "received", verifiedAt: new Date(), verifiedBy: session.sub, note: undefined }
          : { ...current, state: "awaiting", note: input.note };
    }
    order.payment = next;
    order.markModified("payment");
    await order.save();

    const what = `${order.orderNo} · ${inr(order.amount ?? 0)}`;
    if (input.action === "submit") {
      await notifyRole(
        ["admin", "superadmin"],
        `Payment to check · ${order.orderNo}`,
        `${clinic?.name ?? "A clinic"} says it paid ${inr(order.amount ?? 0)} by ${PAY_METHOD_LABEL[input.method]}, ref ${input.reference.trim()}. Check it arrived, then confirm the order.`,
        "info",
        `/admin/inventory/orders/${id}`
      );
    } else if (order.clinicId) {
      await notify(
        String(order.clinicId),
        input.action === "received" ? `Payment received · ${order.orderNo}` : `Payment not found · ${order.orderNo}`,
        input.action === "received"
          ? `${what}. Your order goes to the pharmacy to be confirmed.`
          : `${what}. ${input.note} Check the reference and record it again.`,
        input.action === "received" ? "success" : "warning",
        `/clinic/orders/${id}`
      );
    }

    await AuditLog.create({
      actorId: session.sub,
      actorRole: session.role,
      action: `order.payment.${input.action}`,
      entity: "Order",
      entityId: id,
      before,
      after: {
        orderNo: order.orderNo,
        state: next.state,
        method: next.method ? PAY_METHOD_LABEL[next.method as keyof typeof PAY_METHOD_LABEL] : null,
        reference: next.reference ?? null,
        ...(input.action === "not_received" ? { note: input.note } : {}),
      },
    });

    return ok({ payment: { state: next.state } });
  } catch (err) {
    return handleError(err);
  }
}
