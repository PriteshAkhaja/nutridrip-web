import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { clinicNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { connectDB } from "@/lib/db/mongoose";
import { Allocation, BatchLot, Consumption, Order, ProductMaster } from "@/lib/models";
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
  const timeline: TimelineItem[] = [
    { label: "Raised", time: stamp(order.createdAt), state: "done" },
    {
      label: "Confirmed — stock reserved",
      time: order.confirmedAt ? stamp(order.confirmedAt) : cancelled ? "—" : "Waiting on the pharmacy",
      state: order.confirmedAt ? "done" : cancelled ? "next" : "now",
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
          <Card padding="p-5">
            <span className="t-micro">Summary</span>
            <div className="flex flex-col gap-2 mt-4">
              {[
                ["Patient reference", order.patientRef ?? "—"],
                ["Session kits", order.includeKits ? "Included" : "Excluded"],
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
