import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { adminNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { connectDB } from "@/lib/db/mongoose";
import { Order, User } from "@/lib/models";
import { DataTable, THead, TH, TR, TD } from "@/components/ui/Table";
import { StatusPill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/States";
import { formatInr } from "@/lib/inventory/units";
import { formatDate } from "@/lib/data/inventory";
import { ORDER_STATUS } from "@/lib/models/types";
import { listDrips } from "@/lib/data/drips";
import { checkAvailability } from "@/lib/inventory/availability";
import { OrderComposer } from "@/components/orders/OrderComposer";

export const metadata: Metadata = { title: "Preparation orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireRole("superadmin", "admin");
  const nav = await adminNav();
  const { status = "all" } = await searchParams;

  await connectDB();
  const filter = status === "all" ? {} : { status: status.toUpperCase() };
  const orders = await Order.find(filter).sort({ createdAt: -1 }).limit(100).lean<
    Array<{
      _id: unknown;
      orderNo: string;
      patientRef?: string;
      patientName?: string;
      status: string;
      amount: number;
      lines: Array<{ dripName?: string; quantity: number }>;
      createdAt: Date;
      scheduledDelivery?: Date;
    }>
  >();

  const counts = Object.fromEntries(
    await Promise.all(
      ORDER_STATUS.map(async (s) => [s, await Order.countDocuments({ status: s })] as const)
    )
  ) as Record<string, number>;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  const [drips, clinics] = await Promise.all([
    listDrips(),
    User.find({ role: "clinic", status: "active" })
      .sort({ name: 1 })
      .lean<Array<{ _id: unknown; name: string; clinic?: { city?: string } }>>(),
  ]);
  const { results } = await checkAvailability(
    drips.map((d) => ({ dripId: d.id, quantity: 1 })),
    true
  );
  const availableById = new Map(results.map((r) => [r.dripId, r.wholeVialAvailability]));

  return (
    <ConsoleShell
      session={session}
      roleLabel={session.role === "superadmin" ? "Super admin" : "Admin"}
      nav={nav}
      activeHref="/admin/inventory/orders"
      breadcrumb={["Inventory", "Preparation orders"]}
      title="Preparation orders"
      meta={`${total} order${total === 1 ? "" : "s"}`}
    >
      <p className="t-body text-[var(--color-ink-2)] max-w-[76ch] mb-5" style={{ textWrap: "pretty" }}>
        Confirming an order soft-reserves the exact units it will need, so two orders cannot promise the same vial.
        Dispatching consumes them FEFO and writes the immutable consumption ledger. Cancelling releases the
        reservation.
      </p>

      <div className="flex gap-1 p-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] border border-[var(--color-line)] mb-5 w-fit flex-wrap">
        {[["all", "All", total] as const, ...ORDER_STATUS.map((s) => [s.toLowerCase(), s.charAt(0) + s.slice(1).toLowerCase(), counts[s] ?? 0] as const)].map(
          ([key, label, count]) => (
            <Link
              key={key}
              href={`/admin/inventory/orders?status=${key}`}
              className={`px-4 min-h-[36px] inline-flex items-center gap-2 rounded-[6px] text-[13px] font-semibold no-underline hover:no-underline ${
                status === key ? "bg-[var(--color-surface)] text-[var(--color-ink)]" : "text-[var(--color-ink-2)]"
              }`}
            >
              {label}
              <span className="t-data text-[13px] text-[var(--color-ink-3)]">{count}</span>
            </Link>
          )
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_400px] items-start">
      <div>
      {orders.length === 0 ? (
        <EmptyState
          kind="filtered"
          title="No orders in this state"
          body="Nothing matches that filter — which may well be the answer you wanted."
          actionLabel="Show all orders"
          actionHref="/admin/inventory/orders?status=all"
        />
      ) : (
        <DataTable>
          <THead>
            <TR>
              <TH width="150px">Order</TH>
              <TH>Patient reference</TH>
              <TH>Items</TH>
              <TH>Raised</TH>
              <TH>Delivery</TH>
              <TH>Status</TH>
              <TH numeric>Amount</TH>
            </TR>
          </THead>
          <tbody>
            {orders.map((o) => (
              <TR key={String(o._id)}>
                <TD>
                  <Link href={`/admin/inventory/orders/${String(o._id)}`} className="t-data text-[14.5px]">
                    {o.orderNo}
                  </Link>
                </TD>
                <TD>
                  <span className="t-data text-[13px] text-[var(--color-ink-2)]">
                    {o.patientRef ?? o.patientName ?? "—"}
                  </span>
                </TD>
                <TD>
                  {o.lines.map((l) => `${l.dripName} × ${l.quantity}`).join(", ")}
                </TD>
                <TD mono>{formatDate(o.createdAt)}</TD>
                <TD mono>{o.scheduledDelivery ? formatDate(o.scheduledDelivery) : "—"}</TD>
                <TD>
                  <StatusPill status={o.status} dot />
                </TD>
                <TD numeric>{formatInr(o.amount ?? 0)}</TD>
              </TR>
            ))}
          </tbody>
        </DataTable>
      )}
      </div>

      <OrderComposer
        mode="admin"
        clinics={clinics.map((c) => ({ id: String(c._id), name: c.name, city: c.clinic?.city ?? "" }))}
        drips={drips.map((d) => ({
          id: d.id,
          name: d.name,
          priceInr: d.priceInr,
          available: availableById.get(d.id) ?? 0,
          category: d.category,
          keywords: d.headline,
        }))}
      />
      </div>
    </ConsoleShell>
  );
}
