import { Pill } from "@/components/ui/Pill";
import { payState, type OrderPayment } from "@/lib/billing/order-payment";

/**
 * Where a clinic's payment for an order stands, next to the order's status in
 * a list. Nothing for an order on credit, or one cancelled before any money
 * came in. The same state reads differently to the clinic ("being checked")
 * and to the team ("to check"), because it asks something different of each.
 */
export function OrderPayPill({
  order,
  clinicOnCredit = false,
  audience,
}: {
  order: { status: string; clinicId?: unknown; onCredit?: boolean | null; payment?: OrderPayment | null };
  clinicOnCredit?: boolean;
  audience: "clinic" | "team";
}) {
  if (order.payment?.refundDue) return <Pill tone="caution">Refund due</Pill>;
  const state = payState(order, clinicOnCredit);
  if (state === "credit" || order.status === "CANCELLED") return null;
  if (state === "received") return <Pill tone="safe">Paid</Pill>;
  if (state === "submitted") {
    return (
      <Pill tone="info" dot>
        {audience === "team" ? "Payment to check" : "Payment being checked"}
      </Pill>
    );
  }
  return (
    <Pill tone="caution" dot>
      Awaiting payment
    </Pill>
  );
}
