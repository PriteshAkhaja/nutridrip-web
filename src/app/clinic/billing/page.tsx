import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { clinicNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { DataTable, THead, TH, TR, TD } from "@/components/ui/Table";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/States";
import { formatDate } from "@/lib/data/inventory";
import { loadStatement } from "@/lib/billing/statement-data";
import { formatInr } from "@/lib/inventory/units";
import {
  isFutureMonth,
  monthKeyOf,
  monthLabel,
  parseMonth,
  shiftMonth,
} from "@/lib/billing/statement";

export const metadata: Metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

/**
 * A clinic's invoices, month by month.
 *
 * What it lists is what has been invoiced. The app does not record payments —
 * there is no gateway and an invoice has no paid state — so nothing here is
 * called "due", "paid" or "outstanding", and the page says so plainly rather
 * than leave a clinic to assume a balance the software cannot know.
 */
export default async function ClinicBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await requireRole("clinic", "superadmin");
  const { month: rawMonth } = await searchParams;
  const now = new Date();
  const month = parseMonth(rawMonth, now);
  const thisMonth = monthKeyOf(now);

  const [nav, statement] = await Promise.all([clinicNav(session.sub), loadStatement(session.sub, month)]);
  const { rows, totals, missing } = statement;

  const prev = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const href = (m: string) => `/clinic/billing?month=${m}`;
  const nothing = rows.length === 0 && missing.length === 0;

  const nav_link =
    "t-body font-semibold inline-flex items-center min-h-[44px] no-underline hover:underline";

  return (
    <ConsoleShell
      session={session}
      roleLabel="Partner clinic"
      nav={nav}
      activeHref="/clinic/billing"
      breadcrumb={["Clinic", "Billing"]}
      title="Billing"
      meta={monthLabel(month)}
    >
      <p className="t-body text-[var(--color-ink-2)] max-w-[76ch] mb-6" style={{ textWrap: "pretty" }}>
        The invoices raised to you, grouped by the month the goods left. This is what has been invoiced — payments are
        not recorded here, so it is not a balance.
      </p>

      {/* ---------------- Month switcher ---------------- */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-6">
        <div className="flex items-center gap-5">
          <Link href={href(prev)} className={nav_link} aria-label={`Previous month, ${monthLabel(prev)}`}>
            ← {monthLabel(prev)}
          </Link>
          {!isFutureMonth(next, now) ? (
            <Link href={href(next)} className={nav_link} aria-label={`Next month, ${monthLabel(next)}`}>
              {monthLabel(next)} →
            </Link>
          ) : null}
          {month !== thisMonth ? (
            <Link href={href(thisMonth)} className={nav_link}>
              This month
            </Link>
          ) : null}
        </div>

        {rows.length > 0 ? (
          <ButtonLink href={`/clinic/billing/statement?month=${month}`} variant="secondary">
            Print or save as PDF
          </ButtonLink>
        ) : null}
      </div>

      {/* ---------------- Figures ---------------- */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4 mb-6">
        {[
          ["Invoices", String(totals.count)],
          ["Taxable value", formatInr(totals.taxable)],
          ["GST", formatInr(totals.gst)],
          ["Total invoiced", formatInr(totals.total)],
        ].map(([label, value]) => (
          <Card key={label} padding="p-5">
            <span className="t-micro">{label}</span>
            <div className="t-data text-[22px] mt-2 break-words">{value}</div>
          </Card>
        ))}
      </div>

      {/* ---------------- Dispatched but not yet invoiced ---------------- */}
      {missing.length > 0 ? (
        <div className="mb-6">
          <Card tone="caution" padding="p-5">
            <h2 className="t-h3 mb-2">
              {missing.length} order{missing.length === 1 ? "" : "s"} sent in {monthLabel(month)} not yet invoiced
            </h2>
            <p className="t-body text-[var(--color-ink-2)] max-w-[66ch] mb-3">
              An invoice is raised the first time it is opened. Until then these are not in the figures above.
            </p>
            <div className="flex flex-wrap gap-x-6">
              {missing.map((o) => (
                <Link
                  key={o.id}
                  href={`/invoice/${o.id}`}
                  className="t-data text-[14.5px] inline-flex items-center min-h-[44px]"
                >
                  {o.orderNo}
                  {o.dispatchedAt ? ` · ${formatDate(o.dispatchedAt)}` : ""} → open invoice
                </Link>
              ))}
            </div>
          </Card>
        </div>
      ) : null}

      {/* ---------------- The invoices ---------------- */}
      {nothing ? (
        <EmptyState
          kind={isFutureMonth(month, now) ? "filtered" : "first-run"}
          title={`No invoices in ${monthLabel(month)}`}
          body={
            isFutureMonth(month, now)
              ? "That month has not happened yet."
              : "An invoice appears here once an order you placed has been dispatched and its invoice opened."
          }
          actionLabel={month === thisMonth ? undefined : "Go to this month"}
          actionHref={month === thisMonth ? undefined : href(thisMonth)}
        />
      ) : rows.length > 0 ? (
        <DataTable>
          <THead>
            <TR>
              <TH width="170px">Invoice</TH>
              <TH>Sent</TH>
              <TH>Order</TH>
              <TH>Document</TH>
              <TH numeric>Taxable</TH>
              <TH numeric>GST</TH>
              <TH numeric>Total</TH>
            </TR>
          </THead>
          <tbody>
            {rows.map((r) => (
              <TR key={r.invoiceNo + r.orderId}>
                <TD nowrap>
                  {r.orderId ? (
                    <Link href={`/invoice/${r.orderId}`} className="t-data text-[14.5px]">
                      {r.invoiceNo}
                    </Link>
                  ) : (
                    <span className="t-data text-[14.5px]">{r.invoiceNo}</span>
                  )}
                </TD>
                <TD mono nowrap>{r.date ? formatDate(r.date) : "—"}</TD>
                <TD mono nowrap>{r.orderNo}</TD>
                <TD nowrap>
                  <Pill tone="neutral">{r.documentType === "bill_of_supply" ? "Bill of supply" : "Tax invoice"}</Pill>
                </TD>
                <TD numeric nowrap>{formatInr(r.taxable)}</TD>
                <TD numeric nowrap>{r.gst ? formatInr(r.gst) : "—"}</TD>
                <TD numeric nowrap>{formatInr(r.total)}</TD>
              </TR>
            ))}
            <TR>
              <TD nowrap><span className="font-semibold">Total</span></TD>
              <TD>{" "}</TD>
              <TD>{" "}</TD>
              <TD>{" "}</TD>
              <TD numeric nowrap><span className="font-semibold">{formatInr(totals.taxable)}</span></TD>
              <TD numeric nowrap><span className="font-semibold">{totals.gst ? formatInr(totals.gst) : "—"}</span></TD>
              <TD numeric nowrap><span className="font-semibold">{formatInr(totals.total)}</span></TD>
            </TR>
          </tbody>
        </DataTable>
      ) : null}

      <p className="t-small text-[var(--color-ink-3)] mt-4 max-w-[76ch]" style={{ textWrap: "pretty" }}>
        A month holds the invoices whose goods left in it. Totals include any round-off shown on the invoice itself.
        For a copy of a single invoice, open it from the list.
      </p>
    </ConsoleShell>
  );
}
