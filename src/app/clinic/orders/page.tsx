import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { clinicNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { connectDB } from "@/lib/db/mongoose";
import { Order, User } from "@/lib/models";
import { listDrips } from "@/lib/data/drips";
import { checkAvailability } from "@/lib/inventory/availability";
import { DataTable, THead, TH, TR, TD, Pieces } from "@/components/ui/Table";
import { StatusPill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/States";
import { formatInr } from "@/lib/inventory/units";
import { formatDate } from "@/lib/data/inventory";
import { OrderComposer } from "@/components/orders/OrderComposer";
import { PagedResults, PagedView, Pagination } from "@/components/ui/Paged";
import { parsePaging } from "@/lib/pagination";
import { paginate } from "@/lib/pagination-db";
import { OrderPayPill } from "@/components/ui/OrderPayPill";
import type { OrderPayment } from "@/lib/billing/order-payment";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function ClinicOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const session = await requireRole("clinic", "superadmin");
  const { page, pageSize } = await searchParams;
  const paging = parsePaging({ page, pageSize });
  const nav = await clinicNav(session.sub);
  await connectDB();

  // This list had no limit at all. A clinic that has ordered every week for a
  // year would have downloaded every order on every visit.
  type OrderRow = {
    _id: unknown;
    orderNo: string;
    status: string;
    amount: number;
    lines: Array<{ dripName?: string; quantity: number }>;
    createdAt: Date;
    scheduledDelivery?: Date;
    clinicId?: unknown;
    onCredit?: boolean;
    payment?: OrderPayment;
  };
  // Scoped by the session's clinic id, in the query, as everything here is.
  const { rows: orders, meta } = await paginate<OrderRow>(
    Order,
    { clinicId: session.sub },
    { sort: { createdAt: -1 }, paging }
  );

  // This clinic's terms, for orders placed before each order kept its own.
  const me = await User.findById(session.sub).select("clinic.onCredit").lean<{ clinic?: { onCredit?: boolean } } | null>();
  const onCreditNow = me?.clinic?.onCredit ?? false;

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
      meta={`${meta.total} order${meta.total === 1 ? "" : "s"}`}
    >
      {/* Side by side only from 1760px. Below that the table takes the full width and this panel sits under it: with names and dates held on one line, the table does not fit beside the panel on a laptop or a 1536-1680px monitor (measured; the orders list beside its 400px composer needs about 1740px). */}
      <div className="grid grid-cols-1 gap-6 min-[1760px]:grid-cols-[minmax(0,1fr)_400px] items-start">
        <div>
          {orders.length === 0 ? (
            <EmptyState
              kind="first-run"
              title="No orders yet"
              body="Order the drips you expect to run this week. The pharmacy reserves the stock on confirmation, so a confirmed order is a promise you can plan against."
            />
          ) : (
            <PagedView>
              <PagedResults>
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
                    <TD nowrap>
                      <Link href={`/clinic/orders/${String(o._id)}`} className="t-data text-[14.5px]">
                        {o.orderNo}
                      </Link>
                    </TD>
                    <TD><Pieces items={o.lines.map((l) => `${l.dripName} × ${l.quantity}`)} /></TD>
                    <TD mono nowrap>{formatDate(o.createdAt)}</TD>
                    <TD mono nowrap>{o.scheduledDelivery ? formatDate(o.scheduledDelivery) : "—"}</TD>
                    <TD>
                      <span className="flex gap-2 flex-wrap items-center">
                        <StatusPill status={o.status} dot />
                        <OrderPayPill order={o} clinicOnCredit={onCreditNow} audience="clinic" />
                      </span>
                    </TD>
                    <TD numeric>{formatInr(o.amount ?? 0)}</TD>
                  </TR>
                ))}
              </tbody>
            </DataTable>
              </PagedResults>
              <Pagination meta={meta} basePath="/clinic/orders" params={{ pageSize }} nouns={["order", "orders"]} />
            </PagedView>
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
