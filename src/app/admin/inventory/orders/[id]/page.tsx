import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { adminNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { connectDB } from "@/lib/db/mongoose";
import { Allocation, BatchLot, Consumption, Order, ProductMaster } from "@/lib/models";
import { planAllocation } from "@/lib/inventory/dispatch";
import { checkAvailability } from "@/lib/inventory/availability";
import { DataTable, THead, TH, TR, TD } from "@/components/ui/Table";
import { StatusPill, Pill } from "@/components/ui/Pill";
import { Card } from "@/components/ui/Card";
import { formatInr } from "@/lib/inventory/units";
import { formatDate, formatTime } from "@/lib/data/inventory";
import { OrderActions } from "./Actions";
import { VerifyPayment } from "./VerifyPayment";
import { User } from "@/lib/models";
import { PAY_METHOD_LABEL, confirmBlockedBy, payState, type OrderPayment, type PayMethod } from "@/lib/billing/order-payment";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Order" };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("superadmin", "admin");
  const nav = await adminNav();
  const { id } = await params;

  await connectDB();
  const order = await Order.findById(id).lean<{
    _id: unknown;
    orderNo: string;
    patientRef?: string;
    patientName?: string;
    status: string;
    amount: number;
    includeKits: boolean;
    notes?: string;
    lines: Array<{ dripId: unknown; dripName?: string; quantity: number; withKit: boolean; unitPrice: number }>;
    createdAt: Date;
    confirmedAt?: Date;
    dispatchedAt?: Date;
    cancelledAt?: Date;
    scheduledDelivery?: Date;
    clinicId?: unknown;
    onCredit?: boolean;
    payment?: OrderPayment & { paidOn?: Date; submittedAt?: Date; verifiedAt?: Date };
  } | null>();

  if (!order) notFound();

  // A clinic that pays first: where its payment stands, and whether that holds the order up.
  const clinic = order.clinicId
    ? await User.findById(order.clinicId).select("name clinic.onCredit").lean<{ name: string; clinic?: { onCredit?: boolean } } | null>()
    : null;
  const pay = payState(order, clinic?.clinic?.onCredit ?? false);
  const payBlock = order.status === "DRAFT" ? confirmBlockedBy(order, clinic?.clinic?.onCredit ?? false) : null;
  const method = order.payment?.method ? PAY_METHOD_LABEL[order.payment.method as PayMethod] : null;

  const isDraft = order.status === "DRAFT";
  const isConfirmed = order.status === "CONFIRMED";
  const isDispatched = order.status === "DISPATCHED";

  // A draft is checked against live stock; a confirmed order shows what it holds.
  const [availability, plan, allocations, consumption] = await Promise.all([
    isDraft
      ? checkAvailability(
          order.lines.map((l) => ({ dripId: String(l.dripId), quantity: l.quantity })),
          order.includeKits
        )
      : Promise.resolve(null),
    isDraft ? planAllocation(id) : Promise.resolve(null),
    isConfirmed
      ? Allocation.find({ orderId: id, releasedAt: null }).lean<
          Array<{ _id: unknown; lotId: unknown; masterId: unknown; unitsReserved: number }>
        >()
      : Promise.resolve([]),
    isDispatched
      ? Consumption.find({ orderId: id }).lean<
          Array<{
            _id: unknown;
            drugName?: string;
            batchNo?: string;
            unitsConsumed: number;
            activeUsed: number;
            wasted: number;
            contentUnit?: string;
          }>
        >()
      : Promise.resolve([]),
  ]);

  const lotById = new Map(
    (
      await BatchLot.find({
        _id: { $in: allocations.map((a) => a.lotId) },
      }).lean<Array<{ _id: unknown; batchNo: string; expiry: Date }>>()
    ).map((l) => [String(l._id), l])
  );
  const masterById = new Map(
    (
      await ProductMaster.find({
        _id: { $in: allocations.map((a) => a.masterId) },
      }).lean<Array<{ _id: unknown; name: string }>>()
    ).map((m) => [String(m._id), m])
  );

  const canFulfil = availability?.results.every((r) => r.canFulfil) ?? true;
  const shortfalls = plan?.shortfalls ?? [];

  return (
    <ConsoleShell
      session={session}
      roleLabel={session.role === "superadmin" ? "Super admin" : "Admin"}
      nav={nav}
      activeHref="/admin/inventory/orders"
      breadcrumb={["Inventory", "Orders", order.orderNo]}
      title={order.orderNo}
      meta={`Raised ${formatDate(order.createdAt)}`}
      actions={
        <OrderActions
          orderId={String(order._id)}
          status={order.status}
          canConfirm={canFulfil && shortfalls.length === 0 && !payBlock}
          confirmNote={payBlock}
        />
      }
    >
      {/* ---------------- Status banner ---------------- */}
      <div className="flex items-center gap-4 flex-wrap mb-6">
        <StatusPill status={order.status} dot />
        {order.confirmedAt && (
          <span className="t-small text-[var(--color-ink-3)]">
            Confirmed {formatDate(order.confirmedAt)} · {formatTime(order.confirmedAt)}
          </span>
        )}
        {order.dispatchedAt && (
          <span className="t-small text-[var(--color-ink-3)]">
            Dispatched {formatDate(order.dispatchedAt)} · {formatTime(order.dispatchedAt)}
          </span>
        )}
        {order.cancelledAt && (
          <span className="t-small text-[var(--color-ink-3)]">Cancelled {formatDate(order.cancelledAt)}</span>
        )}
      </div>

      {/* ---------------- The clinic's payment ---------------- */}
      {pay !== "credit" && (order.status === "DRAFT" || pay === "received" || order.payment?.refundDue) && (
        <Card
          tone={pay === "received" ? "safe" : pay === "submitted" ? "info" : order.payment?.refundDue ? "caution" : "muted"}
          padding="p-5"
          className="mb-6"
        >
          {order.payment?.refundDue ? (
            <>
              <span className="t-body font-semibold block">Refund due to the clinic</span>
              <span className="t-body text-[var(--color-ink-2)]">
                Cancelled after the payment arrived: {formatInr(order.amount ?? 0)} ({method}, ref{" "}
                <span className="t-data text-[14px]">{order.payment?.reference}</span>) is owed back to{" "}
                {clinic?.name ?? "the clinic"}.
              </span>
            </>
          ) : pay === "received" ? (
            <>
              <span className="t-body font-semibold block">Paid</span>
              <span className="t-body text-[var(--color-ink-2)]">
                {formatInr(order.amount ?? 0)} by {method}, ref <span className="t-data text-[14px]">{order.payment?.reference}</span>
                {order.payment?.verifiedAt ? ` · received ${formatDate(order.payment.verifiedAt)}` : ""}
              </span>
            </>
          ) : pay === "submitted" ? (
            <>
              <span className="t-body font-semibold block">Payment to check</span>
              <p className="t-body text-[var(--color-ink-2)] mt-1 mb-4">
                {clinic?.name ?? "The clinic"} says it paid <span className="t-data text-[14px]">{formatInr(order.amount ?? 0)}</span> by{" "}
                {method}, ref <span className="t-data text-[14px]">{order.payment?.reference}</span>
                {order.payment?.paidOn ? `, on ${formatDate(order.payment.paidOn)}` : ""}. Check it is in the account, then
                mark it received — the order can be confirmed after that.
              </p>
              <VerifyPayment orderId={String(order._id)} />
            </>
          ) : (
            <>
              <span className="t-body font-semibold block">Waiting for the clinic&rsquo;s payment</span>
              <span className="t-body text-[var(--color-ink-2)]">
                {clinic?.name ?? "The clinic"} pays {formatInr(order.amount ?? 0)} first; this order can be confirmed once
                the payment is received.
                {order.payment?.note ? ` Last sent back: “${order.payment.note}”` : ""}
              </span>
            </>
          )}
        </Card>
      )}

      {isDraft && shortfalls.length > 0 && (
        <Card tone="critical" className="mb-6">
          <span className="t-body font-semibold">Not enough in-date stock to confirm</span>
          <ul className="flex flex-col gap-1 mt-2 list-none p-0 m-0">
            {shortfalls.map((s) => (
              <li key={s.masterId} className="t-body text-[var(--color-ink-2)]">
                {s.drugName} — short for {s.shortUnits} draw{s.shortUnits === 1 ? "" : "s"}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start">
        <div className="flex flex-col gap-6">
          {/* ---------------- Lines ---------------- */}
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

          {/* ---------------- Allocations / ledger ---------------- */}
          {isConfirmed && allocations.length > 0 && (
            <section>
              <h2 className="t-h3 mb-1">Reserved stock</h2>
              <p className="t-body text-[var(--color-ink-2)] mb-3">
                These units are still on the shelf but no longer count as available.
              </p>
              <DataTable>
                <THead>
                  <TR>
                    <TH>Drug</TH>
                    <TH>Batch</TH>
                    <TH>Expiry</TH>
                    <TH numeric>Units reserved</TH>
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

          {isDispatched && consumption.length > 0 && (
            <section>
              <h2 className="t-h3 mb-1">Consumption ledger</h2>
              <p className="t-body text-[var(--color-ink-2)] mb-3">
                Immutable. This is the recall trail — which batch fed this order, and how much of it was wasted.
              </p>
              <DataTable>
                <THead>
                  <TR>
                    <TH>Drug</TH>
                    <TH>Batch</TH>
                    <TH numeric>Units</TH>
                    <TH numeric>Active used</TH>
                    <TH numeric>Wasted</TH>
                  </TR>
                </THead>
                <tbody>
                  {consumption.map((c) => (
                    <TR key={String(c._id)}>
                      <TD nowrap>{c.drugName ?? "—"}</TD>
                      <TD mono nowrap>{c.batchNo ?? "—"}</TD>
                      <TD numeric>{c.unitsConsumed}</TD>
                      <TD numeric nowrap>
                        {c.activeUsed.toLocaleString("en-IN")} {c.contentUnit}
                      </TD>
                      <TD numeric nowrap className={c.wasted > 0 ? "text-[var(--color-caution-text)]" : ""}>
                        {c.wasted > 0 ? `${c.wasted.toLocaleString("en-IN")} ${c.contentUnit}` : "—"}
                      </TD>
                    </TR>
                  ))}
                </tbody>
              </DataTable>
            </section>
          )}
        </div>

        {/* ---------------- Rail ---------------- */}
        <div className="flex flex-col gap-4">
          <Card padding="p-5">
            <span className="t-micro">Summary</span>
            <div className="flex flex-col gap-2 mt-4">
              {[
                ["Patient reference", order.patientRef ?? order.patientName ?? "—"],
                ["Session kits", order.includeKits ? "Included" : "Excluded"],
                ["Delivery", order.scheduledDelivery ? formatDate(order.scheduledDelivery) : "—"],
                ...(clinic ? [["Clinic", clinic.name]] : []),
                ...(order.clinicId ? [["Payment", pay === "credit" ? "On credit — invoice, 30 days" : "Paid before it is confirmed"]] : []),
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

          {/* The clinic's own copy of this is on their order page. It is here
              too so the desk can re-send one, or answer a query about it,
              without asking the clinic to read their own bill out. */}
          {isDispatched && (
            <Card padding="p-5">
              <span className="t-micro block mb-2">Tax invoice</span>
              <p className="t-body text-[var(--color-ink-2)] mb-4">
                Raised against this order the first time it is opened, and the same document every time after.
              </p>
              <Link href={`/invoice/${String(order._id)}`} className="t-body font-semibold">
                Open the invoice &rarr;
              </Link>
            </Card>
          )}

          {isDraft && availability && (
            <Card padding="p-5">
              <span className="t-micro">Feasibility · live</span>
              <div className="flex flex-col gap-4 mt-4">
                {availability.results.map((r) => (
                  <div key={r.dripId} className="flex flex-col gap-1">
                    <div className="flex justify-between gap-3 items-baseline">
                      <span className="t-body font-medium">{r.dripName}</span>
                      <span className="t-data text-[14.5px]">
                        {r.wholeVialAvailability} / {r.requested}
                      </span>
                    </div>
                    <span
                      className="t-small"
                      style={{ color: r.canFulfil ? "var(--color-safe)" : "var(--color-critical)" }}
                    >
                      {r.canFulfil
                        ? "Enough in date to prepare"
                        : `Short by ${r.requested - r.wholeVialAvailability}`}
                      {r.bottleneck ? ` · limited by ${r.bottleneck.ingredient}` : ""}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {isDraft && plan && plan.draws.length > 0 && (
            <Card padding="p-5" tone="muted">
              <span className="t-micro">Would draw · FEFO</span>
              <div className="flex flex-col gap-2 mt-4">
                {plan.draws.slice(0, 12).map((d) => (
                  <div key={d.lotId} className="flex justify-between gap-3 items-baseline">
                    <span className="t-body text-[var(--color-ink-2)] truncate">{d.drugName}</span>
                    <span className="t-data text-[13px]">
                      {d.batchNo} · {d.units}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </ConsoleShell>
  );
}
