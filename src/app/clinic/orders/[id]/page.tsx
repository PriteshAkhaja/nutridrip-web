import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { clinicNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { connectDB } from "@/lib/db/mongoose";
import { Allocation, BatchLot, Consumption, Order, ProductMaster, User } from "@/lib/models";
import { PAY_METHOD_LABEL, payState, type OrderPayment, type PayMethod } from "@/lib/billing/order-payment";
import { getPayee, hasPayee } from "@/lib/billing/settings";
import { PayOrderForm } from "./PayOrderForm";
import { DataTable, THead, TH, TR, TD } from "@/components/ui/Table";
import { StatusPill, Pill } from "@/components/ui/Pill";
import { Card } from "@/components/ui/Card";
import { Timeline, type TimelineItem } from "@/components/ui/Timeline";
import { formatInr } from "@/lib/inventory/units";
import { formatDate, formatTime } from "@/lib/data/inventory";

export const metadata: Metadata = { title: "Order" };
export const dynamic = "force-dynamic";

const stamp = (d?: Date) => (d ? `${formatDate(d)} · ${formatTime(d)}` : "—");

export default async function ClinicOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("clinic", "superadmin");
  const nav = await clinicNav(session.sub);
  const { id } = await params;

  await connectDB();
  const order = await Order.findById(id).lean<{
    _id: unknown;
    orderNo: string;
    clinicId?: unknown;
    patientRef?: string;
    status: string;
    amount: number;
    includeKits: boolean;
    notes?: string;
    cancelReason?: string;
    lines: Array<{ dripName?: string; quantity: number; withKit: boolean; unitPrice: number }>;
    createdAt: Date;
    confirmedAt?: Date;
    dispatchedAt?: Date;
    cancelledAt?: Date;
    scheduledDelivery?: Date;
    onCredit?: boolean;
    payment?: OrderPayment & { paidOn?: Date; submittedAt?: Date; verifiedAt?: Date };
  } | null>();

  // A clinic only ever sees its own orders.
  if (!order) notFound();
  if (session.role === "clinic" && String(order.clinicId) !== session.sub) notFound();

  const [allocations, consumption] = await Promise.all([
    order.status === "CONFIRMED"
      ? Allocation.find({ orderId: id, releasedAt: null }).lean<
          Array<{ _id: unknown; lotId: unknown; masterId: unknown; unitsReserved: number }>
        >()
      : Promise.resolve([]),
    order.status === "DISPATCHED"
      ? Consumption.find({ orderId: id }).lean<
          Array<{ _id: unknown; drugName?: string; batchNo?: string; unitsConsumed: number; lotId: unknown }>
        >()
      : Promise.resolve([]),
  ]);

  const lotIds = [...allocations.map((a) => a.lotId), ...consumption.map((c) => c.lotId)];
  const lots = await BatchLot.find({ _id: { $in: lotIds } }).lean<
    Array<{ _id: unknown; batchNo: string; expiry: Date; brandName: string }>
  >();
  const lotById = new Map(lots.map((l) => [String(l._id), l]));
  const masters = await ProductMaster.find({ _id: { $in: allocations.map((a) => a.masterId) } }).lean<
    Array<{ _id: unknown; name: string }>
  >();
  const masterById = new Map(masters.map((m) => [String(m._id), m]));

  const cancelled = order.status === "CANCELLED";

  // Paying first, unless the clinic is on credit (see lib/billing/order-payment).
  const clinic = order.clinicId
    ? await User.findById(order.clinicId).select("clinic.onCredit").lean<{ clinic?: { onCredit?: boolean } } | null>()
    : null;
  const pay = payState(order, clinic?.clinic?.onCredit ?? false);
  const payFirst = pay !== "credit";
  const payee = pay === "awaiting" || pay === "submitted" ? await getPayee() : null;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const method = order.payment?.method ? PAY_METHOD_LABEL[order.payment.method as PayMethod] : null;
  const paid = pay === "received";
  const timeline: TimelineItem[] = [
    { label: "Raised", time: stamp(order.createdAt), state: "done" },
    // Paid first: the step between placing the order and the pharmacy taking it.
    ...(payFirst
      ? [
          {
            label: "Paid — payment received",
            time: paid
              ? stamp(order.payment?.verifiedAt)
              : cancelled
                ? "—"
                : pay === "submitted"
                  ? "Payment recorded — NutriDrip is checking it"
                  : "Waiting for your payment",
            state: (paid ? "done" : cancelled ? "next" : "now") as TimelineItem["state"],
          },
        ]
      : []),
    {
      label: "Confirmed — stock reserved",
      time: order.confirmedAt
        ? stamp(order.confirmedAt)
        : cancelled
          ? "—"
          : payFirst && !paid
            ? "Once your payment is received"
            : "Waiting on the pharmacy",
      state: order.confirmedAt ? "done" : cancelled || (payFirst && !paid) ? "next" : "now",
    },
    {
      label: "Dispatched — batches on their way",
      time: order.dispatchedAt ? stamp(order.dispatchedAt) : "—",
      state: order.dispatchedAt ? "done" : order.confirmedAt && !cancelled ? "now" : "next",
    },
  ];
  if (cancelled) timeline.push({ label: "Cancelled", time: stamp(order.cancelledAt), state: "done" });

  return (
    <ConsoleShell
      session={session}
      roleLabel="Partner clinic"
      nav={nav}
      activeHref="/clinic/orders"
      breadcrumb={["Clinic", "Orders", order.orderNo]}
      title={order.orderNo}
      meta={`Raised ${formatDate(order.createdAt)}`}
    >
      <div className="flex items-center gap-4 flex-wrap mb-6">
        <StatusPill status={order.status} dot />
        {order.scheduledDelivery && (
          <span className="t-small text-[var(--color-ink-3)]">Needed by {formatDate(order.scheduledDelivery)}</span>
        )}
        {order.cancelReason && <span className="t-small text-[var(--color-ink-2)]">{order.cancelReason}</span>}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start">
        <div className="flex flex-col gap-6">
          {!cancelled && (pay === "awaiting" || pay === "submitted") && (
            <Card padding="p-6" tone={pay === "awaiting" ? "primary" : undefined}>
              {pay === "awaiting" ? (
                <>
                  <span className="t-micro block">Payment needed</span>
                  <h2 className="t-h3 mt-1">Pay {formatInr(order.amount ?? 0)} to confirm this order</h2>
                  <p className="t-body text-[var(--color-ink-2)] mt-1 max-w-[62ch]">
                    The pharmacy prepares it once your payment has arrived. Pay by UPI or bank transfer, then record
                    it here.
                  </p>
                  {order.payment?.note && (
                    <div className="rounded-[var(--radius-md)] border border-[var(--color-caution)] bg-[var(--color-caution-soft)] px-4 py-3 mt-4">
                      <span className="t-body font-semibold block">We could not find your payment</span>
                      <span className="t-body text-[var(--color-ink-2)]">{order.payment.note}</span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <span className="t-micro block">Payment recorded</span>
                  <h2 className="t-h3 mt-1">NutriDrip is checking it has arrived</h2>
                  <p className="t-body text-[var(--color-ink-2)] mt-1">
                    <span className="t-data text-[14px]">{formatInr(order.amount ?? 0)}</span> by {method}, ref{" "}
                    <span className="t-data text-[14px]">{order.payment?.reference}</span>
                    {order.payment?.paidOn ? `, paid ${formatDate(order.payment.paidOn)}` : ""}. Your order goes to the
                    pharmacy once it has.
                  </p>
                </>
              )}

              {payee && (
                <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 mt-4">
                  <span className="t-micro block mb-2">Pay to</span>
                  {hasPayee(payee) ? (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 m-0">
                      {(
                        [
                          ["UPI ID", payee.upiId],
                          ["Account name", payee.accountName],
                          ["Bank", payee.bankName],
                          ["Account number", payee.accountNo],
                          ["IFSC", payee.ifsc],
                        ] as const
                      )
                        .filter(([, v]) => v)
                        .map(([k, v]) => (
                          <div key={k} className="contents">
                            <dt className="t-small text-[var(--color-ink-2)]">{k}</dt>
                            <dd className="t-data text-[14px] m-0 break-all">{v}</dd>
                          </div>
                        ))}
                    </dl>
                  ) : (
                    <span className="t-body text-[var(--color-ink-2)]">
                      Payment details have not been set up yet. Contact NutriDrip for where to pay.
                    </span>
                  )}
                </div>
              )}

              <div className="mt-5">
                {pay === "awaiting" ? (
                  <PayOrderForm orderId={id} today={today} />
                ) : (
                  <details>
                    <summary className="t-body font-medium cursor-pointer text-[var(--color-primary-text)]">
                      Correct the payment details
                    </summary>
                    <div className="mt-4">
                      <PayOrderForm
                        orderId={id}
                        today={today}
                        submitLabel="Save the correction"
                        initial={{
                          method: (order.payment?.method as PayMethod) ?? "upi",
                          reference: order.payment?.reference ?? "",
                          paidOn: order.payment?.paidOn
                            ? new Date(order.payment.paidOn).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
                            : today,
                        }}
                      />
                    </div>
                  </details>
                )}
              </div>
            </Card>
          )}

          <section>
            <h2 className="t-h3 mb-3">Order lines</h2>
            <DataTable>
              <THead>
                <TR>
                  <TH>Drip</TH>
                  <TH numeric>Qty</TH>
                  <TH>Kit</TH>
                  <TH numeric>Unit price</TH>
                  <TH numeric>Line total</TH>
                </TR>
              </THead>
              <tbody>
                {order.lines.map((l, i) => (
                  <TR key={i}>
                    <TD nowrap>{l.dripName}</TD>
                    <TD numeric>{l.quantity}</TD>
                    <TD>{l.withKit ? <Pill tone="primary">Included</Pill> : <span className="t-small">—</span>}</TD>
                    <TD numeric>{formatInr(l.unitPrice)}</TD>
                    <TD numeric>{formatInr(l.unitPrice * l.quantity)}</TD>
                  </TR>
                ))}
              </tbody>
            </DataTable>
          </section>

          {allocations.length > 0 && (
            <section>
              <h2 className="t-h3 mb-1">Reserved for you</h2>
              <p className="t-body text-[var(--color-ink-2)] mb-3">
                These units are held against your order. Nothing else can claim them.
              </p>
              <DataTable>
                <THead>
                  <TR>
                    <TH>Drug</TH>
                    <TH>Batch</TH>
                    <TH>Expiry</TH>
                    <TH numeric>Units</TH>
                  </TR>
                </THead>
                <tbody>
                  {allocations.map((a) => {
                    const lot = lotById.get(String(a.lotId));
                    return (
                      <TR key={String(a._id)}>
                        <TD nowrap>{masterById.get(String(a.masterId))?.name ?? "—"}</TD>
                        <TD mono nowrap>{lot?.batchNo ?? "—"}</TD>
                        <TD mono nowrap>{lot ? formatDate(lot.expiry) : "—"}</TD>
                        <TD numeric>{a.unitsReserved}</TD>
                      </TR>
                    );
                  })}
                </tbody>
              </DataTable>
            </section>
          )}

          {consumption.length > 0 && (
            <section>
              <h2 className="t-h3 mb-1">Batch numbers</h2>
              <p className="t-body text-[var(--color-ink-2)] mb-3">
                What was dispatched, by batch — keep these with your records. A recall notice is answered against
                them.
              </p>
              <DataTable>
                <THead>
                  <TR>
                    <TH>Drug</TH>
                    <TH>Brand</TH>
                    <TH>Batch</TH>
                    <TH>Expiry</TH>
                    <TH numeric>Units</TH>
                  </TR>
                </THead>
                <tbody>
                  {consumption.map((c) => {
                    const lot = lotById.get(String(c.lotId));
                    return (
                      <TR key={String(c._id)}>
                        <TD nowrap>{c.drugName ?? "—"}</TD>
                        <TD nowrap>{lot?.brandName ?? "—"}</TD>
                        <TD mono nowrap>{c.batchNo ?? lot?.batchNo ?? "—"}</TD>
                        <TD mono nowrap>{lot ? formatDate(lot.expiry) : "—"}</TD>
                        <TD numeric>{c.unitsConsumed}</TD>
                      </TR>
                    );
                  })}
                </tbody>
              </DataTable>
            </section>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card padding="p-5">
            <span className="t-micro block mb-4">Where it is</span>
            <Timeline items={timeline} />
          </Card>
          {paid && (
            <Card padding="p-5" tone="safe">
              <span className="t-micro block mb-1">Paid</span>
              <span className="t-body">
                {formatInr(order.amount ?? 0)} by {method}, ref{" "}
                <span className="t-data text-[14px]">{order.payment?.reference}</span>
              </span>
              <span className="t-small text-[var(--color-ink-2)] block mt-1">
                Received {order.payment?.verifiedAt ? stamp(order.payment.verifiedAt) : ""}
              </span>
            </Card>
          )}
          {cancelled && order.payment?.refundDue && (
            <Card padding="p-5" tone="caution">
              <span className="t-micro block mb-1">Refund due</span>
              <span className="t-body">
                This order was cancelled after your payment arrived. {formatInr(order.amount ?? 0)} is due back to you.
              </span>
            </Card>
          )}
          <Card padding="p-5">
            <span className="t-micro">Summary</span>
            <div className="flex flex-col gap-2 mt-4">
              {[
                ["Patient reference", order.patientRef ?? "—"],
                ["Session kits", order.includeKits ? "Included" : "Excluded"],
                ["Payment", payFirst ? "Paid before it is confirmed" : "On credit — invoice, 30 days"],
                ["Total", formatInr(order.amount ?? 0)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 items-baseline">
                  <span className="t-body text-[var(--color-ink-2)]">{k}</span>
                  <span className="t-data text-[14.5px] text-right">{v}</span>
                </div>
              ))}
            </div>
            {order.notes && <p className="t-small text-[var(--color-ink-2)] mt-4">{order.notes}</p>}
          </Card>
          {/* Only once the stock has actually left. Before dispatch nothing has
              been supplied, and a bill for goods still on the shelf is one the
              clinic would be right to query. */}
          {order.status === "DISPATCHED" ? (
            <Card padding="p-5">
              <span className="t-micro block mb-2">Tax invoice</span>
              <p className="t-body text-[var(--color-ink-2)] mb-4">
                Raised against this order, with GST and the batches supplied. Print it or save it as a PDF.
              </p>
              <Link href={`/invoice/${String(order._id)}`} className="t-body font-semibold">
                Download invoice &rarr;
              </Link>
            </Card>
          ) : null}
        </div>
      </div>
    </ConsoleShell>
  );
}
