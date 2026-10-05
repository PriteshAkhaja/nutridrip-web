import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { adminNav } from "@/lib/nav";
import { can } from "@/lib/auth/rbac";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, Invoice, Order, Payment, User } from "@/lib/models";
import { DataTable, THead, TH, TR, TD } from "@/components/ui/Table";
import { Pill, type PillTone } from "@/components/ui/Pill";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import { PagedResults, PagedView, Pagination } from "@/components/ui/Paged";
import { hrefWith, parsePaging } from "@/lib/pagination";
import { paginate } from "@/lib/pagination-db";
import { formatDate, formatTime } from "@/lib/data/inventory";
import { getClockFormat } from "@/lib/settings/clock";
import { paymentsSetup } from "@/lib/payments/config";
import { LEDGER_VIEWS, ledgerFilter, parseView } from "@/lib/payments/admin";
import { sweepBookingMoney } from "@/lib/payments/money";
import { inrFromPaise, PURPOSE_LABEL, REFUND_KIND_LABEL } from "@/lib/payments/rules";
import { refundedOf, type RefundEntry } from "@/lib/payments/refunds";
import { PaymentActions } from "./PaymentActions";

export const metadata: Metadata = { title: "Payments" };
export const dynamic = "force-dynamic";

type Row = {
  _id: unknown;
  receiptNo: string;
  purpose: string;
  status: string;
  amount: number;
  payerId: unknown;
  payerRole: string;
  bookingId?: unknown;
  orderId?: unknown;
  invoiceId?: unknown;
  methodLabel?: string;
  paidAt?: Date;
  createdAt: Date;
  rzpOrderId?: string;
  rzpPaymentId?: string;
  apply?: { state?: string; error?: string };
  refunds?: RefundEntry[];
  attention?: string;
  failures?: Array<{ description?: string }>;
};

const STATUS: Record<string, { tone: PillTone; label: string }> = {
  created: { tone: "neutral", label: "Not paid" },
  failed: { tone: "caution", label: "Attempt failed" },
  paid: { tone: "safe", label: "Paid" },
  partially_refunded: { tone: "info", label: "Part refunded" },
  refunded: { tone: "neutral", label: "Refunded" },
};

/**
 * Every payment taken through Razorpay: what it was for, who paid, how, and
 * everything that happened to it since. The refunds rules call for happen by
 * themselves; this is where a person sees them, retries one that failed, and
 * makes one by hand.
 */
export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; page?: string; pageSize?: string }>;
}) {
  const clockFmt = await getClockFormat();
  const session = await requireRole("superadmin", "admin");
  const nav = await adminNav();
  const { view: rawView, page, pageSize } = await searchParams;
  const view = parseView(rawView);
  const paging = parsePaging({ page, pageSize });
  const setup = paymentsSetup();
  // The setup details (mode, key, webhook, refund speed) are for testing: shown
  // with test keys or on a developer's machine, and kept out of sight with live
  // keys in production.
  const showSetup = setup.mode === "test" || process.env.NODE_ENV !== "production";

  await connectDB();
  // Refunds a session is owed that an earlier run did not get to finish go now,
  // before the ledger shows where things stand.
  if (setup.enabled) await sweepBookingMoney();
  const { rows, meta } = await paginate<Row>(Payment, ledgerFilter(view), { sort: { createdAt: -1 }, paging });
  const counts = Object.fromEntries(
    await Promise.all(
      LEDGER_VIEWS.map(async (v) => [v.key, await Payment.countDocuments(ledgerFilter(v.key))] as const)
    )
  ) as Record<string, number>;

  // The month's figures, in paise: what came in, what went back, what is still on its way.
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const [inAgg, backAgg, pendingAgg] = await Promise.all([
    Payment.aggregate<{ total: number; count: number }>([
      { $match: { paidAt: { $gte: monthStart }, status: { $in: ["paid", "partially_refunded", "refunded"] } } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate<{ total: number }>([
      { $unwind: "$refunds" },
      { $match: { "refunds.at": { $gte: monthStart }, "refunds.status": { $ne: "failed" } } },
      { $group: { _id: null, total: { $sum: "$refunds.amount" } } },
    ]),
    Payment.aggregate<{ total: number; count: number }>([
      { $unwind: "$refunds" },
      { $match: { "refunds.status": "pending" } },
      { $group: { _id: null, total: { $sum: "$refunds.amount" }, count: { $sum: 1 } } },
    ]),
  ]);
  const figures: Array<{ label: string; value: string; note: string; tone?: "critical" }> = [
    {
      label: "Collected this month",
      value: inrFromPaise(inAgg[0]?.total ?? 0),
      note: `${inAgg[0]?.count ?? 0} payment${(inAgg[0]?.count ?? 0) === 1 ? "" : "s"}`,
    },
    { label: "Refunded this month", value: inrFromPaise(backAgg[0]?.total ?? 0), note: "Started or processed" },
    {
      label: "Refunds on their way",
      value: inrFromPaise(pendingAgg[0]?.total ?? 0),
      note: `${pendingAgg[0]?.count ?? 0} waiting on the bank`,
    },
    {
      label: "Needs attention",
      value: String(counts.attention ?? 0),
      note: (counts.attention ?? 0) > 0 ? "A refund failed or a payment stalled" : "Nothing to look at",
      ...((counts.attention ?? 0) > 0 ? { tone: "critical" as const } : {}),
    },
  ];

  // Names for the people and references for the things paid for, a page at a time.
  const ids = (pick: (r: Row) => unknown) => rows.map(pick).filter(Boolean);
  const [payers, bookings, orders, invoices] = await Promise.all([
    User.find({ _id: { $in: ids((r) => r.payerId) } })
      .select("name")
      .lean<Array<{ _id: unknown; name: string }>>(),
    Booking.find({ _id: { $in: ids((r) => r.bookingId) } })
      .select("bookingNo")
      .lean<Array<{ _id: unknown; bookingNo: string }>>(),
    Order.find({ _id: { $in: ids((r) => r.orderId) } })
      .select("orderNo")
      .lean<Array<{ _id: unknown; orderNo: string }>>(),
    Invoice.find({ _id: { $in: ids((r) => r.invoiceId) } })
      .select("invoiceNo orderId")
      .lean<Array<{ _id: unknown; invoiceNo: string; orderId: unknown }>>(),
  ]);
  const name = new Map(payers.map((u) => [String(u._id), u.name]));
  const bookingNo = new Map(bookings.map((b) => [String(b._id), b.bookingNo]));
  const orderNo = new Map(orders.map((o) => [String(o._id), o.orderNo]));
  const invoiceNo = new Map(invoices.map((i) => [String(i._id), i.invoiceNo]));

  const stamp = (d?: Date) => (d ? `${formatDate(d)} · ${formatTime(d, clockFmt)}` : "—");
  const canRefund = can(session.role, "payments.refund");

  return (
    <ConsoleShell
      session={session}
      roleLabel={session.role === "superadmin" ? "Super admin" : "Admin"}
      nav={nav}
      activeHref="/admin/payments"
      breadcrumb={["Admin", "Payments"]}
      title="Payments"
      meta={setup.enabled ? (setup.mode === "live" ? "Razorpay · live" : "Razorpay · test mode") : "Not set up"}
    >
      {!setup.enabled ? (
        <Card tone="caution" padding="p-5">
          <h2 className="t-h3">Online payment is not set up</h2>
          <p className="t-body text-[var(--color-ink-2)] mt-1 max-w-[70ch]">
            Add the Razorpay keys to the server&rsquo;s environment (RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET) and
            restart it. Until then patients book without paying and clinics pay by transfer, as before.
          </p>
        </Card>
      ) : showSetup ? (
        <div className="flex flex-wrap gap-2 mb-5">
          <Pill tone={setup.mode === "live" ? "safe" : "info"}>
            {setup.mode === "live" ? "Live payments" : "Test mode — no real money moves"}
          </Pill>
          <Pill tone={setup.webhook ? "safe" : "caution"}>
            {setup.webhook ? "Webhook secret set" : "Webhook not set up — payments still confirm, more slowly"}
          </Pill>
          <Pill tone="neutral">Key ending {setup.keyIdTail}</Pill>
          <Pill tone="neutral">
            {setup.refundSpeed === "optimum" ? "Instant refunds where possible" : "Normal refunds"}
          </Pill>
        </div>
      ) : !setup.webhook ? (
        // Live, with the details hidden, one thing is still said: without the
        // webhook, a payment whose browser closed waits for someone to press Check.
        <Card tone="caution" padding="p-5" className="mb-5">
          <span className="t-body font-semibold">The Razorpay webhook is not set up</span>
          <p className="t-body text-[var(--color-ink-2)] mt-1 max-w-[70ch]">
            Payments still confirm, but one whose browser closed at the wrong moment waits here until someone presses
            Check. Add the webhook in Razorpay and RAZORPAY_WEBHOOK_SECRET on the server.
          </p>
        </Card>
      ) : null}

      {setup.enabled && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mt-5">
          {figures.map((f) => (
            <Card key={f.label} padding="p-5" tone={f.tone === "critical" ? "critical" : undefined}>
              <span className="t-micro">{f.label}</span>
              <div className="t-data text-[22px] mt-2 break-words">{f.value}</div>
              <span className="t-small text-[var(--color-ink-3)]">{f.note}</span>
            </Card>
          ))}
        </div>
      )}

      <div className="flex gap-1 p-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] border border-[var(--color-line)] mb-5 w-fit flex-wrap mt-5">
        {LEDGER_VIEWS.map((v) => (
          <Link
            key={v.key}
            href={hrefWith("/admin/payments", { pageSize }, { view: v.key })}
            className={`px-4 min-h-[36px] inline-flex items-center gap-2 rounded-[6px] text-[13px] font-semibold no-underline hover:no-underline ${
              view === v.key ? "bg-[var(--color-surface)] text-[var(--color-ink)]" : "text-[var(--color-ink-2)]"
            }`}
          >
            {v.label}
            <span
              className={`t-data text-[13px] ${
                v.key === "attention" && (counts[v.key] ?? 0) > 0
                  ? "text-[var(--color-critical-text)]"
                  : "text-[var(--color-ink-3)]"
              }`}
            >
              {counts[v.key] ?? 0}
            </span>
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          kind={view === "all" ? "first-run" : "filtered"}
          title={
            view === "attention"
              ? "Nothing needs attention"
              : view === "refunds"
                ? "No refunds yet"
                : view === "unpaid"
                  ? "No unfinished checkouts"
                  : "No payments yet"
          }
          body={
            view === "attention"
              ? "A refund that fails, or a payment that stalls, appears here — and everyone on the admin team is notified."
              : "Payments made through Razorpay — sessions, late fees, clinic orders and invoices — appear here."
          }
          actionLabel={view === "all" ? undefined : "Show all"}
          actionHref={view === "all" ? undefined : "/admin/payments"}
        />
      ) : (
        <PagedView>
          <PagedResults>
            <DataTable>
              <THead>
                <TR>
                  <TH>Receipt</TH>
                  <TH>For</TH>
                  <TH>Paid by</TH>
                  <TH>How</TH>
                  <TH numeric>Amount</TH>
                  <TH numeric>Refunded</TH>
                  <TH>Status</TH>
                  <TH>&nbsp;</TH>
                </TR>
              </THead>
              <tbody>
                {rows.map((r) => {
                  const refunded = refundedOf(r.refunds);
                  const st = STATUS[r.status] ?? { tone: "neutral" as PillTone, label: r.status };
                  const payer = name.get(String(r.payerId)) ?? "—";
                  const ref =
                    r.bookingId && bookingNo.get(String(r.bookingId))
                      ? bookingNo.get(String(r.bookingId))
                      : r.invoiceId && invoiceNo.get(String(r.invoiceId))
                        ? invoiceNo.get(String(r.invoiceId))
                        : r.orderId && orderNo.get(String(r.orderId))
                          ? orderNo.get(String(r.orderId))
                          : null;
                  const href =
                    r.purpose === "order" && r.orderId
                      ? `/admin/inventory/orders/${String(r.orderId)}`
                      : r.purpose === "invoice" && r.orderId
                        ? `/invoice/${String(r.orderId)}`
                        : r.payerRole === "patient"
                          ? `/admin/users/${String(r.payerId)}`
                          : null;
                  const lastRefund = r.refunds?.at(-1);
                  return (
                    <TR key={String(r._id)}>
                      <TD nowrap>
                        <div className="flex flex-col">
                          <span className="t-data text-[13.5px]">{r.receiptNo}</span>
                          <span className="t-small text-[var(--color-ink-3)]">{stamp(r.paidAt ?? r.createdAt)}</span>
                        </div>
                      </TD>
                      <TD>
                        <div className="flex flex-col">
                          <span className="font-medium">{PURPOSE_LABEL[r.purpose] ?? r.purpose}</span>
                          {ref ? (
                            href ? (
                              <Link href={href} className="t-data text-[13px]">
                                {ref}
                              </Link>
                            ) : (
                              <span className="t-data text-[13px] text-[var(--color-ink-3)]">{ref}</span>
                            )
                          ) : r.purpose === "booking" && r.apply?.state === "failed" ? (
                            <span className="t-small text-[var(--color-ink-3)]">Not booked</span>
                          ) : null}
                        </div>
                      </TD>
                      <TD>
                        <div className="flex flex-col">
                          <span>{payer}</span>
                          <span className="t-small text-[var(--color-ink-3)] capitalize">{r.payerRole}</span>
                        </div>
                      </TD>
                      <TD>
                        <span className="t-small">{r.methodLabel ?? "—"}</span>
                      </TD>
                      <TD numeric nowrap>
                        {inrFromPaise(r.amount)}
                      </TD>
                      <TD numeric nowrap>
                        {refunded ? inrFromPaise(refunded) : "—"}
                      </TD>
                      <TD>
                        <div className="flex flex-col gap-1 items-start max-w-[240px] whitespace-normal">
                          <Pill tone={r.attention ? "critical" : st.tone}>
                            {r.attention ? "Needs attention" : st.label}
                          </Pill>
                          {r.attention === "refund_failed" ? (
                            <span className="t-small text-[var(--color-critical-text)]">
                              Refund not made — retry it
                            </span>
                          ) : r.attention === "duplicate_unrefunded" ? (
                            <span className="t-small text-[var(--color-critical-text)]">
                              Paid twice — refund the second in Razorpay
                            </span>
                          ) : r.apply?.state === "pending" ? (
                            <span className="t-small text-[var(--color-caution-text)]">Being applied</span>
                          ) : r.apply?.state === "failed" ? (
                            <span className="t-small text-[var(--color-ink-2)]">Could not be completed · refunded</span>
                          ) : lastRefund && lastRefund.status !== "failed" ? (
                            <span className="t-small text-[var(--color-ink-3)]">
                              {REFUND_KIND_LABEL[lastRefund.kind] ?? lastRefund.kind}
                              {lastRefund.status === "processed" ? "" : " · on its way"}
                            </span>
                          ) : r.status === "failed" && r.failures?.at(-1)?.description ? (
                            <span className="t-small text-[var(--color-ink-3)]">{r.failures.at(-1)?.description}</span>
                          ) : null}
                          {(r.apply?.state === "failed" && r.apply.error) || (r.attention && lastRefund?.error) ? (
                            <details className="t-small">
                              <summary className="cursor-pointer text-[var(--color-primary-text)]">Why</summary>
                              <p className="mt-1 text-[var(--color-ink-2)]">
                                {r.attention && lastRefund?.error ? lastRefund.error : r.apply?.error}
                              </p>
                            </details>
                          ) : null}
                        </div>
                      </TD>
                      <TD>
                        <PaymentActions
                          paymentId={String(r._id)}
                          payerName={payer}
                          refundable={
                            ["paid", "partially_refunded"].includes(r.status) ? Math.max(0, r.amount - refunded) : 0
                          }
                          canRefund={canRefund && setup.enabled}
                          canCheck={setup.enabled}
                        />
                      </TD>
                    </TR>
                  );
                })}
              </tbody>
            </DataTable>
          </PagedResults>
          <Pagination
            meta={meta}
            basePath="/admin/payments"
            params={{ view, pageSize }}
            nouns={["payment", "payments"]}
          />
        </PagedView>
      )}
    </ConsoleShell>
  );
}
