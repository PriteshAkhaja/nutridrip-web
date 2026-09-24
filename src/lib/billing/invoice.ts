import { connectDB } from "@/lib/db/mongoose";
import { Consumption, Drip, Invoice, Order, User } from "@/lib/models";
import { getContent } from "@/lib/content";
import { chargesGst, getBillingConfig } from "@/lib/billing/settings";
import { createWithReference, nextReference } from "@/lib/sequence";
import {
  documentTypeFor,
  isInterState,
  PRICES_INCLUDE_GST,
  round2,
  roundOffFor,
  splitTax,
  stateCodeFromGstin,
  stateName,
} from "@/lib/billing/gst";
import { PAY_METHOD_LABEL, type PayMethod } from "@/lib/billing/order-payment";

export type InvoiceParty = {
  name: string;
  gstin?: string;
  address?: string;
  stateCode?: string;
  stateName?: string;
};

export type InvoiceLine = {
  description: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  gstRate: number;
  taxableValue: number;
  cgst: number;
  sgst: number;
  igst: number;
  lineTotal: number;
};

export type InvoiceView = {
  invoiceNo: string;
  orderId: string;
  orderNo: string;
  issuedAt: Date;
  suppliedAt?: Date;
  seller: InvoiceParty;
  buyer: InvoiceParty;
  documentType: "tax_invoice" | "bill_of_supply";
  placeOfSupply?: string;
  interState: boolean;
  pricesIncludeGst: boolean;
  terms?: string;
  lines: InvoiceLine[];
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  roundOff: number;
  grandTotal: number;
  batches: string[];
};

type OrderDoc = {
  _id: unknown;
  orderNo: string;
  clinicId?: unknown;
  status: string;
  dispatchedAt?: Date;
  lines: Array<{ dripId?: unknown; dripName?: string; quantity: number; unitPrice: number }>;
  payment?: { state?: string; method?: string; reference?: string; paidOn?: Date };
};

/**
 * The invoice's terms line. An order the clinic paid for first says so, with
 * the payment, rather than the credit terms ("payable within 30 days") that
 * would ask for the money a second time.
 */
export function termsFor(order: Pick<OrderDoc, "payment">, creditTerms: string): string {
  const p = order.payment;
  if (p?.state !== "received") return creditTerms;
  const how = PAY_METHOD_LABEL[p.method as PayMethod] ?? "payment";
  const on = p.paidOn ? ` on ${new Date(p.paidOn).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}` : "";
  return `Paid in advance${on} by ${how}${p.reference ? `, ref ${p.reference}` : ""}. Nothing further is due.`;
}

/**
 * Who may see a clinic's bill.
 *
 * The clinic it was raised for, and the people who run the pharmacy that
 * dispatched it. Not a physician, a nurse or a patient — none of them is party
 * to what a partner clinic was charged, and a bill carries the clinic's GSTIN
 * and trading terms.
 */
export function mayInvoice(
  order: { clinicId?: unknown },
  viewer: { sub: string; role: string }
): boolean {
  if (viewer.role === "superadmin" || viewer.role === "admin") return true;
  if (viewer.role === "clinic") return String(order.clinicId) === viewer.sub;
  return false;
}

/** Why an order cannot be invoiced yet, or null when it can. */
export function blockedReason(order: { status: string }): string | null {
  if (order.status === "DISPATCHED") return null;
  if (order.status === "CANCELLED") return "This order was cancelled, so nothing was supplied to bill for.";
  if (order.status === "DRAFT") return "This order has not been confirmed yet.";
  return "Stock is reserved but has not left the pharmacy. An invoice is raised once the order is dispatched.";
}

/**
 * The invoice for an order, raising it the first time it is asked for.
 *
 * Not written during dispatch, for a practical reason: dispatch runs inside a
 * transaction and a transaction needs a replica set, so it cannot be exercised
 * on a developer's machine. Raising the invoice on first download keeps the
 * whole path testable, and the unique index on orderId keeps it to one.
 */
export async function ensureInvoice(
  orderId: string,
  viewer: { sub: string; role: string }
): Promise<{ invoice: InvoiceView } | { error: string }> {
  await connectDB();

  const order = await Order.findById(orderId).lean<OrderDoc | null>();
  if (!order) return { error: "That order does not exist." };
  if (!mayInvoice(order, viewer)) return { error: "That order is not yours." };

  const blocked = blockedReason(order);
  if (blocked) return { error: blocked };

  const existing = await Invoice.findOne({ orderId }).lean<InvoiceView | null>();
  if (existing) return { invoice: existing };

  const [copy, billing, clinic, drips, consumed] = await Promise.all([
    getContent(),
    getBillingConfig(),
    order.clinicId
      ? User.findById(order.clinicId).lean<{
          name: string;
          clinic?: { gstin?: string; address?: string; city?: string; pincode?: string };
        } | null>()
      : Promise.resolve(null),
    Drip.find({ _id: { $in: order.lines.map((l) => l.dripId).filter(Boolean) } })
      .select("hsnCode gstRate")
      .lean<Array<{ _id: unknown; hsnCode?: string; gstRate?: number }>>(),
    Consumption.find({ orderId }).select("batchNo").lean<Array<{ batchNo?: string }>>(),
  ]);

  const taxById = new Map(drips.map((d) => [String(d._id), d]));

  const seller: InvoiceParty = {
    name: copy["footer.legalName"],
    // Only when GST is actually switched on. A GSTIN left in the settings with
    // the switch off must not reappear on a bill as though it were charging.
    gstin: chargesGst(billing) ? billing.gstin : undefined,
    address: billing.address || undefined,
  };
  seller.stateCode = stateCodeFromGstin(seller.gstin) ?? undefined;
  seller.stateName = stateName(seller.stateCode) ?? undefined;

  const buyer: InvoiceParty = {
    name: clinic?.name ?? "Walk-in",
    gstin: clinic?.clinic?.gstin,
    address: [clinic?.clinic?.address, clinic?.clinic?.city, clinic?.clinic?.pincode]
      .filter(Boolean)
      .join(", "),
  };
  buyer.stateCode = stateCodeFromGstin(buyer.gstin) ?? undefined;
  buyer.stateName = stateName(buyer.stateCode) ?? undefined;

  const interState = isInterState(seller.gstin, buyer.gstin);
  // Where the supply is taxed: the buyer's state when they are registered
  // there, otherwise our own.
  const placeOfSupply = buyer.stateName ?? seller.stateName;

  /**
   * GST is optional, and it is optional in two independent ways.
   *
   * We may not be registered — a supplier without a GSTIN may not charge GST
   * at all, whatever any drip says — and an individual supply may be exempt or
   * simply not classified yet. A missing rate is therefore nil, never a
   * helpful 12%: tax a clinic was never told about is a worse error than a
   * bill that charges none.
   */
  const registered = chargesGst(billing);

  const lines: InvoiceLine[] = order.lines.map((l) => {
    const tax = taxById.get(String(l.dripId));
    const gstRate = registered ? (tax?.gstRate ?? 0) : 0;
    const lineTotal = round2(l.unitPrice * l.quantity);
    const split = splitTax(lineTotal, gstRate, interState);
    return {
      description: l.dripName ?? "Drip",
      hsnCode: tax?.hsnCode,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      gstRate,
      taxableValue: split.taxableValue,
      cgst: split.cgst,
      sgst: split.sgst,
      igst: split.igst,
      lineTotal,
    };
  });

  const sum = (pick: (l: InvoiceLine) => number) => round2(lines.reduce((n, l) => n + pick(l), 0));
  const taxableTotal = sum((l) => l.taxableValue);
  const cgstTotal = sum((l) => l.cgst);
  const sgstTotal = sum((l) => l.sgst);
  const igstTotal = sum((l) => l.igst);
  const { grandTotal, roundOff } = roundOffFor(
    round2(taxableTotal + cgstTotal + sgstTotal + igstTotal)
  );
  const documentType = documentTypeFor(
    seller.gstin,
    cgstTotal + sgstTotal + igstTotal > 0
  );

  const year = new Date().getFullYear();
  const created = await createWithReference(
    (invoiceNo) =>
      Invoice.create({
        invoiceNo,
        orderId,
        orderNo: order.orderNo,
        clinicId: order.clinicId,
        suppliedAt: order.dispatchedAt,
        seller,
        buyer,
        documentType,
        placeOfSupply,
        interState,
        pricesIncludeGst: PRICES_INCLUDE_GST,
        terms: termsFor(order, billing.terms),
        lines,
        taxableTotal,
        cgstTotal,
        sgstTotal,
        igstTotal,
        roundOff,
        grandTotal,
        batches: [...new Set(consumed.map((c) => c.batchNo).filter(Boolean))] as string[],
      }),
    (attempt) =>
      nextReference(
        Invoice,
        "invoiceNo",
        (n) => `INV-${year}-${String(n).padStart(4, "0")}`,
        (ref) => Number(ref.split("-")[2] ?? 0),
        attempt
      )
  ).catch(async (err: unknown) => {
    // Two downloads at once: the unique index on orderId stopped the second,
    // and the first one's invoice is the answer for both.
    if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
      return Invoice.findOne({ orderId });
    }
    throw err;
  });

  if (!created) return { error: "Could not raise an invoice for that order." };
  return { invoice: (created.toObject?.() ?? created) as InvoiceView };
}
