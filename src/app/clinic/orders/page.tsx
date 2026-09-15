import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { clinicNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { connectDB } from "@/lib/db/mongoose";
import { Order } from "@/lib/models";
import { listDrips } from "@/lib/data/drips";
import { checkAvailability } from "@/lib/inventory/availability";
import { DataTable, THead, TH, TR, TD } from "@/components/ui/Table";
import { StatusPill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/States";
import { formatInr } from "@/lib/inventory/units";
import { formatDate } from "@/lib/data/inventory";
import { OrderComposer } from "@/components/orders/OrderComposer";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function ClinicOrdersPage() {
  const session = await requireRole("clinic", "superadmin");
  const nav = await clinicNav(session.sub);
  await connectDB();

  const orders = await Order.find({ clinicId: session.sub })
    .sort({ createdAt: -1 })
    .lean<
      Array<{
        _id: unknown;
        orderNo: string;
        status: string;
        amount: number;
        lines: Array<{ dripName?: string; quantity: number }>;
        createdAt: Date;
        scheduledDelivery?: Date;
      }>
    >();

  const drips = await listDrips();
  const { results } = await checkAvailability(
    drips.map((d) => ({ dripId: d.id, quantity: 1 })),
    true
  );
  const availableById = new Map(results.map((r) => [r.dripId, r.wholeVialAvailability]));

  return (
    <ConsoleShell
      session={session}
      roleLabel="Partner clinic"
      nav={nav}
      activeHref="/clinic/orders"
      breadcrumb={["Clinic", "Orders"]}
      title="Preparation orders"
      meta={`${orders.length} order${orders.length === 1 ? "" : "s"}`}
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_400px] items-start">
        <div>
          {orders.length === 0 ? (
            <EmptyState
              kind="first-run"
              title="No orders yet"
              body="Order the drips you expect to run this week. The pharmacy reserves the stock on confirmation, so a confirmed order is a promise you can plan against."
            />
          ) : (
            <DataTable>
              <THead>
                <TR>
                  <TH width="150px">Order</TH>
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
                      <Link href={`/clinic/orders/${String(o._id)}`} className="t-data text-[14.5px]">
                        {o.orderNo}
                      </Link>
                    </TD>
                    <TD>{o.lines.map((l) => `${l.dripName} × ${l.quantity}`).join(", ")}</TD>
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

          <p className="t-small text-[var(--color-ink-3)] mt-4">
            A draft holds nothing. Confirmation is what reserves the vials, and only the pharmacy can dispatch. Open
            an order to see the batch numbers once it has gone out.
          </p>
        </div>

        <OrderComposer
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
