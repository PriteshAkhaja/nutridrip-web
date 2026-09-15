import Link from "next/link";
import type { Metadata } from "next";
import { requireSession } from "@/lib/auth/guard";
import { getContent } from "@/lib/content";
import { LogoMark } from "@/components/layout/Logo";
import { formatInr } from "@/lib/inventory/units";
import { formatDate } from "@/lib/data/inventory";
import { DOCUMENT_TITLE, hsnSummary, rateLabel, taxBasisLabel } from "@/lib/billing/gst";
import { ensureInvoice } from "@/lib/billing/invoice";
import { PrintButton } from "@/components/ui/PrintButton";
import { Arrow } from "@/components/ui/Arrow";

export const metadata: Metadata = { title: "Tax invoice" };
export const dynamic = "force-dynamic";

/**
 * The tax invoice for a dispatched order.
 *
 * It sits outside both consoles because two roles reach it — the clinic that
 * was supplied, and the pharmacy that supplied them — and a document meant to
 * be printed has no use for console furniture around it either way.
 *
 * Downloading is the browser's own Print → Save as PDF, as the prescription
 * slip already does. A PDF library would give the same sheet and one more
 * dependency to keep patched.
 */
export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const { id } = await params;

  const [result, copy] = await Promise.all([ensureInvoice(id, session), getContent()]);
  const home = session.role === "clinic" ? `/clinic/orders/${id}` : `/admin/inventory/orders`;

  if ("error" in result) {
    return (
      <div className="min-h-screen bg-[var(--color-surface-2)] py-12 px-5">
        <div className="mx-auto max-w-[560px] rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-8">
          <h1 className="t-h3">No invoice for this order</h1>
          <p className="t-body text-[var(--color-ink-2)] mt-2">{result.error}</p>
          <Link href={home} className="t-body font-semibold inline-block mt-5">
            <Arrow dir="left" />&nbsp;Back to the order
          </Link>
        </div>
      </div>
    );
  }

  const inv = result.invoice;
  const anyIgst = inv.igstTotal > 0;
  /**
   * GST is optional, so the sheet has to read correctly without it. A bill of
   * supply carries no tax columns, no place-of-supply line and no CGST/SGST
   * totals — printing empty ones would suggest tax was charged and came to
   * nothing, which is a different statement from not charging it.
   */
  const taxed = inv.documentType === "tax_invoice";
  const summary = taxed ? hsnSummary(inv.lines) : [];

  return (
    <div className="min-h-screen bg-[var(--color-surface-2)] print:bg-white py-8 print:py-0 px-4">
      <div className="no-print mx-auto max-w-[820px] flex items-center justify-between gap-4 mb-5 flex-wrap">
        <Link href={home} className="t-body">
          <Arrow dir="left" />&nbsp;Back to the order
        </Link>
        <PrintButton />
      </div>

      <article className="rx-page mx-auto max-w-[820px] bg-white border border-[var(--color-line)] rounded-[var(--radius-lg)] p-8 md:p-12 print:border-0 print:rounded-none print:p-0">
        <header className="flex items-start justify-between gap-6 pb-6 border-b-2 border-[var(--color-ink)]">
          <div className="flex items-center gap-3">
            <LogoMark size={28} />
            <div className="flex flex-col">
              <span style={{ font: "600 20px/1 var(--font-display)", letterSpacing: "-0.01em" }}>
                {inv.seller.name}
              </span>
              {inv.seller.address ? (
                <span className="t-small text-[var(--color-ink-3)] mt-1 max-w-[38ch]">
                  {inv.seller.address}
                </span>
              ) : null}
              {inv.seller.gstin ? (
                <span className="t-small text-[var(--color-ink-3)] mt-1">
                  GSTIN <span className="t-data">{inv.seller.gstin}</span>
                </span>
              ) : null}
              <span className="t-small text-[var(--color-ink-3)]">
                Clinical establishment reg. <span className="t-data">{copy["footer.registration"]}</span>
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className="t-micro block">{DOCUMENT_TITLE[inv.documentType]}</span>
            <div className="t-data text-[16px] mt-1">{inv.invoiceNo}</div>
            <div className="t-small text-[var(--color-ink-3)] mt-1">{formatDate(inv.issuedAt)}</div>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-2 py-6 border-b border-[var(--color-line)]">
          <div>
            <span className="t-micro">Billed to</span>
            <div className="t-h3 mt-1">{inv.buyer.name}</div>
            {inv.buyer.address ? (
              <div className="t-small text-[var(--color-ink-2)] mt-1">{inv.buyer.address}</div>
            ) : null}
            {inv.buyer.gstin ? (
              <div className="t-small text-[var(--color-ink-2)] mt-1">
                GSTIN <span className="t-data text-[13px]">{inv.buyer.gstin}</span>
              </div>
            ) : null}
          </div>
          <div>
            <span className="t-micro">Against</span>
            <div className="t-data text-[15px] mt-1">{inv.orderNo}</div>
            <div className="flex flex-col gap-1 mt-2 t-small text-[var(--color-ink-2)]">
              <span>
                Supplied:{" "}
                <span className="t-data text-[13px]">
                  {inv.suppliedAt ? formatDate(inv.suppliedAt) : "—"}
                </span>
              </span>
              {taxed ? (
                <span>
                  Place of supply: <span className="t-data text-[13px]">{inv.placeOfSupply ?? "—"}</span>
                </span>
              ) : null}
              {taxed ? (
                <span>
                  Tax:{" "}
                  <span className="t-data text-[13px]">{taxBasisLabel(anyIgst)}</span>
                </span>
              ) : null}
            </div>
          </div>
        </section>

        <section className="py-6">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[560px]">
              <thead>
                <tr className="border-b border-[var(--color-ink)]">
                  <th className="t-micro text-left py-2 pr-3">Description</th>
                  <th className="t-micro text-left py-2 pr-3 w-[92px]">HSN</th>
                  <th className="t-micro text-right py-2 pr-3 w-[52px]">Qty</th>
                  {taxed ? <th className="t-micro text-right py-2 pr-3 w-[60px]">Rate</th> : null}
                  {taxed ? <th className="t-micro text-right py-2 pr-3 w-[96px]">Taxable</th> : null}
                  {taxed ? <th className="t-micro text-right py-2 pr-3 w-[92px]">Tax</th> : null}
                  <th className="t-micro text-right py-2 w-[100px]">Amount</th>
                </tr>
              </thead>
              <tbody>
                {inv.lines.map((l, i) => (
                  <tr key={i} className="border-b border-[var(--color-line)] align-top" style={{ breakInside: "avoid" }}>
                    <td className="py-3 pr-3">
                      <div className="t-body font-semibold">{l.description}</div>
                      <div className="t-small text-[var(--color-ink-3)]">
                        {formatInr(l.unitPrice)} each
                      </div>
                    </td>
                    <td className="t-data text-[13px] py-3 pr-3">{l.hsnCode ?? "—"}</td>
                    <td className="t-data text-[13px] py-3 pr-3 text-right">{l.quantity}</td>
                    {taxed ? (
                      <td className="t-data text-[13px] py-3 pr-3 text-right whitespace-nowrap">
                        {rateLabel(l.gstRate)}
                      </td>
                    ) : null}
                    {taxed ? (
                      <td className="t-data text-[13px] py-3 pr-3 text-right">
                        {formatInr(l.taxableValue)}
                      </td>
                    ) : null}
                    {taxed ? (
                      <td className="t-data text-[13px] py-3 pr-3 text-right">
                        {l.gstRate ? formatInr(l.igst > 0 ? l.igst : l.cgst + l.sgst) : "—"}
                      </td>
                    ) : null}
                    <td className="t-data text-[13px] py-3 text-right">{formatInr(l.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end mt-5">
            <div className="w-full max-w-[320px] flex flex-col gap-2">
              {[
                ...(taxed
                  ? ([
                      ["Taxable value", formatInr(inv.taxableTotal)],
                      ...(anyIgst
                        ? ([["IGST", formatInr(inv.igstTotal)]] as Array<[string, string]>)
                        : ([
                            ["CGST", formatInr(inv.cgstTotal)],
                            ["SGST", formatInr(inv.sgstTotal)],
                          ] as Array<[string, string]>)),
                    ] as Array<[string, string]>)
                  : ([["Subtotal", formatInr(inv.taxableTotal)]] as Array<[string, string]>)),
                ...(inv.roundOff !== 0
                  ? ([["Round off", formatInr(inv.roundOff)]] as Array<[string, string]>)
                  : []),
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 items-baseline">
                  <span className="t-body text-[var(--color-ink-2)]">{k}</span>
                  <span className="t-data text-[14.5px]">{v}</span>
                </div>
              ))}
              <div className="flex justify-between gap-4 items-baseline pt-3 mt-1 border-t-2 border-[var(--color-ink)]">
                <span className="t-body font-semibold">Total payable</span>
                <span className="t-data text-[18px]">{formatInr(inv.grandTotal)}</span>
              </div>
            </div>
          </div>
        </section>

        {summary.length > 0 ? (
          <section className="py-5 border-t border-[var(--color-line)]">
            <span className="t-micro block mb-3">Tax summary, by HSN</span>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse min-w-[520px]">
                <thead>
                  <tr className="border-b border-[var(--color-line-2)]">
                    <th className="t-micro text-left py-2 pr-3">HSN</th>
                    <th className="t-micro text-right py-2 pr-3 w-[60px]">Rate</th>
                    <th className="t-micro text-right py-2 pr-3 w-[110px]">Taxable</th>
                    {anyIgst ? (
                      <th className="t-micro text-right py-2 pr-3 w-[100px]">IGST</th>
                    ) : (
                      <>
                        <th className="t-micro text-right py-2 pr-3 w-[100px]">CGST</th>
                        <th className="t-micro text-right py-2 pr-3 w-[100px]">SGST</th>
                      </>
                    )}
                    <th className="t-micro text-right py-2 w-[100px]">Total tax</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((r) => (
                    <tr key={`${r.hsnCode}-${r.gstRate}`} className="border-b border-[var(--color-line)]">
                      <td className="t-data text-[13px] py-2 pr-3">{r.hsnCode}</td>
                      <td className="t-data text-[13px] py-2 pr-3 text-right whitespace-nowrap">
                        {rateLabel(r.gstRate)}
                      </td>
                      <td className="t-data text-[13px] py-2 pr-3 text-right">{formatInr(r.taxableValue)}</td>
                      {anyIgst ? (
                        <td className="t-data text-[13px] py-2 pr-3 text-right">{formatInr(r.igst)}</td>
                      ) : (
                        <>
                          <td className="t-data text-[13px] py-2 pr-3 text-right">{formatInr(r.cgst)}</td>
                          <td className="t-data text-[13px] py-2 pr-3 text-right">{formatInr(r.sgst)}</td>
                        </>
                      )}
                      <td className="t-data text-[13px] py-2 text-right">{formatInr(r.totalTax)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="t-micro py-2 pr-3" colSpan={2}>
                      Total
                    </td>
                    <td className="t-data text-[13px] py-2 pr-3 text-right">{formatInr(inv.taxableTotal)}</td>
                    {anyIgst ? (
                      <td className="t-data text-[13px] py-2 pr-3 text-right">{formatInr(inv.igstTotal)}</td>
                    ) : (
                      <>
                        <td className="t-data text-[13px] py-2 pr-3 text-right">{formatInr(inv.cgstTotal)}</td>
                        <td className="t-data text-[13px] py-2 pr-3 text-right">{formatInr(inv.sgstTotal)}</td>
                      </>
                    )}
                    <td className="t-data text-[13px] py-2 text-right">
                      {formatInr(inv.cgstTotal + inv.sgstTotal + inv.igstTotal)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
      ) : null}

      {inv.batches.length > 0 ? (
          <section className="py-5 border-t border-[var(--color-line)]">
            <span className="t-micro block mb-2">Batches supplied</span>
            <p className="t-data text-[13px] text-[var(--color-ink-2)]">{inv.batches.join(" · ")}</p>
          </section>
        ) : null}

        <footer className="pt-6 border-t border-[var(--color-line)] grid gap-8 md:grid-cols-[1fr_240px] items-end">
          <div className="flex flex-col gap-2">
            <p className="t-small text-[var(--color-ink-3)]" style={{ textWrap: "pretty" }}>
              {inv.terms}
              {taxed
                ? inv.pricesIncludeGst
                  ? " Prices shown on the order include GST; the taxable value above is that price net of tax."
                  : " GST has been added to the prices shown on the order."
                : inv.seller.gstin
                  ? " This supply is exempt from GST, so no tax has been charged on it."
                  : " Not registered for GST, so no tax has been charged. This is a bill of supply, not a tax invoice."}
            </p>
            <p className="t-small text-[var(--color-ink-3)]">
              This is a computer-generated invoice and is valid without a signature.
            </p>
          </div>
          <div>
            <div className="h-[48px] border-b border-[var(--color-ink)]" />
            <div className="t-small mt-2">For {inv.seller.name}</div>
            <div className="t-small text-[var(--color-ink-3)]">Authorised signatory</div>
          </div>
        </footer>
      </article>
    </div>
  );
}
