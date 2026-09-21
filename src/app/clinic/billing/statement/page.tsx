import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models";
import { getContent } from "@/lib/content";
import { LogoMark } from "@/components/layout/Logo";
import { PrintButton } from "@/components/ui/PrintButton";
import { Arrow } from "@/components/ui/Arrow";
import { formatDate } from "@/lib/data/inventory";
import { chargesGst, getBillingConfig } from "@/lib/billing/settings";
import { loadStatement } from "@/lib/billing/statement-data";
import { monthLabel, parseMonth } from "@/lib/billing/statement";
import { formatInr } from "@/lib/inventory/units";

export const metadata: Metadata = { title: "Statement of invoices" };
export const dynamic = "force-dynamic";

/**
 * The month's invoices on one printable sheet.
 *
 * It sits outside the console for the same reason the invoice does: a document
 * meant for paper has no use for navigation around it, and downloading is the
 * browser's own Print → Save as PDF rather than a PDF library to keep patched.
 *
 * It says what it is not. A clinic's accounts department will read this, and a
 * sheet headed "Statement" invites the reading that it shows a balance. It does
 * not — the app records what was invoiced and nothing about payment — so the
 * sheet says that in a sentence rather than leave it to be assumed.
 */
export default async function StatementPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const session = await requireRole("clinic", "superadmin");
  const { month: rawMonth } = await searchParams;
  const month = parseMonth(rawMonth);

  await connectDB();
  const [statement, billing, copy, clinic] = await Promise.all([
    loadStatement(session.sub, month),
    getBillingConfig(),
    getContent(),
    User.findById(session.sub).select("name clinic").lean<{
      name: string;
      clinic?: { address?: string; city?: string; pincode?: string; gstin?: string };
    } | null>(),
  ]);

  const { rows, totals, missing } = statement;
  const taxed = totals.taxInvoices > 0;
  const back = `/clinic/billing?month=${month}`;

  return (
    <div className="min-h-screen bg-[var(--color-surface-2)] print:bg-white py-8 print:py-0 px-4">
      <div className="no-print mx-auto max-w-[820px] flex items-center justify-between gap-4 mb-5 flex-wrap">
        <Link href={back} className="t-body inline-flex items-center min-h-[44px]">
          <Arrow dir="left" />&nbsp;Back to billing
        </Link>
        <PrintButton />
      </div>

      <article className="rx-page mx-auto max-w-[820px] bg-white border border-[var(--color-line)] rounded-[var(--radius-lg)] p-8 md:p-12 print:border-0 print:rounded-none print:p-0">
        <header className="flex items-start justify-between gap-6 pb-6 border-b-2 border-[var(--color-ink)]">
          <div className="flex items-center gap-3">
            <span className="print-exact">
              <LogoMark size={28} />
            </span>
            <div className="flex flex-col">
              <span style={{ font: "600 20px/1 var(--font-display)", letterSpacing: "-0.01em" }}>
                {copy["footer.legalName"]}
              </span>
              {billing.address ? (
                <span className="t-small text-[var(--color-ink-3)] mt-1 max-w-[38ch]">{billing.address}</span>
              ) : null}
              {chargesGst(billing) && billing.gstin ? (
                <span className="t-small text-[var(--color-ink-3)] mt-1">
                  GSTIN <span className="t-data">{billing.gstin}</span>
                </span>
              ) : null}
              <span className="t-small text-[var(--color-ink-3)]">
                Clinical establishment reg. <span className="t-data">{copy["footer.registration"]}</span>
              </span>
            </div>
          </div>
          <div className="text-right">
            <span style={{ font: "600 20px/1.1 var(--font-display)" }}>Statement of invoices</span>
            <div className="t-body mt-1">{monthLabel(month)}</div>
            <div className="t-small text-[var(--color-ink-3)] mt-1">Prepared {formatDate(new Date())}</div>
          </div>
        </header>

        <section className="py-6 border-b border-[var(--color-line)]">
          <span className="t-micro">Billed to</span>
          <div className="t-h3 mt-1">{clinic?.name ?? session.name}</div>
          {clinic?.clinic?.address || clinic?.clinic?.city ? (
            <div className="t-small text-[var(--color-ink-2)] mt-1">
              {[clinic.clinic?.address, clinic.clinic?.city, clinic.clinic?.pincode].filter(Boolean).join(", ")}
            </div>
          ) : null}
          {clinic?.clinic?.gstin ? (
            <div className="t-small text-[var(--color-ink-3)] mt-1">
              GSTIN <span className="t-data">{clinic.clinic.gstin}</span>
            </div>
          ) : null}
        </section>

        <section className="py-6">
          {rows.length === 0 ? (
            <p className="t-body text-[var(--color-ink-2)]">No invoices were raised for goods sent in {monthLabel(month)}.</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-[var(--color-ink)]">
                  <th className="t-micro text-left py-2 pr-3">Invoice</th>
                  <th className="t-micro text-left py-2 pr-3">Sent</th>
                  <th className="t-micro text-left py-2 pr-3">Order</th>
                  <th className="t-micro text-right py-2 pr-3">Taxable</th>
                  {taxed ? <th className="t-micro text-right py-2 pr-3">GST</th> : null}
                  <th className="t-micro text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.invoiceNo + r.orderId} className="border-b border-[var(--color-line)]" style={{ breakInside: "avoid" }}>
                    <td className="t-data text-[13px] py-3 pr-3 whitespace-nowrap">
                      {r.invoiceNo}
                      {r.documentType === "bill_of_supply" ? (
                        <span className="t-small text-[var(--color-ink-3)] block">Bill of supply</span>
                      ) : null}
                    </td>
                    <td className="t-data text-[13px] py-3 pr-3 whitespace-nowrap">{r.date ? formatDate(r.date) : "—"}</td>
                    <td className="t-data text-[13px] py-3 pr-3 whitespace-nowrap">{r.orderNo}</td>
                    <td className="t-data text-[13px] py-3 pr-3 text-right whitespace-nowrap">{formatInr(r.taxable)}</td>
                    {taxed ? (
                      <td className="t-data text-[13px] py-3 pr-3 text-right whitespace-nowrap">
                        {r.gst ? formatInr(r.gst) : "—"}
                      </td>
                    ) : null}
                    <td className="t-data text-[13px] py-3 text-right whitespace-nowrap">{formatInr(r.total)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-[var(--color-ink)]">
                  <td className="t-body font-semibold py-3 pr-3" colSpan={3}>
                    Total · {totals.count} invoice{totals.count === 1 ? "" : "s"}
                  </td>
                  <td className="t-data text-[13px] font-semibold py-3 pr-3 text-right whitespace-nowrap">
                    {formatInr(totals.taxable)}
                  </td>
                  {taxed ? (
                    <td className="t-data text-[13px] font-semibold py-3 pr-3 text-right whitespace-nowrap">
                      {formatInr(totals.gst)}
                    </td>
                  ) : null}
                  <td className="t-data text-[13px] font-semibold py-3 text-right whitespace-nowrap">
                    {formatInr(totals.total)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </section>

        {missing.length > 0 ? (
          <section className="py-4 border-t border-[var(--color-line)]">
            <p className="t-small text-[var(--color-ink-2)]" style={{ textWrap: "pretty" }}>
              Not included: {missing.length} order{missing.length === 1 ? "" : "s"} sent in {monthLabel(month)} for
              which no invoice has been raised yet —{" "}
              <span className="t-data">{missing.map((o) => o.orderNo).join(", ")}</span>.
            </p>
          </section>
        ) : null}

        <footer className="pt-6 border-t border-[var(--color-line)]">
          <p className="t-small text-[var(--color-ink-3)]" style={{ textWrap: "pretty" }}>
            This lists the invoices raised for goods that left in {monthLabel(month)}. It records what has been
            invoiced; it is not a record of payments and does not show a balance due. Amounts are shown in whole rupees,
            the same as on each invoice, and include any round-off printed on the invoice itself.
          </p>
        </footer>
      </article>
    </div>
  );
}
