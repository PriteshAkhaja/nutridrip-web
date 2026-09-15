import { Schema, model, models } from "mongoose";

const PartySchema = new Schema(
  {
    name: { type: String, required: true },
    gstin: String,
    address: String,
    stateCode: String,
    stateName: String,
  },
  { _id: false }
);

const InvoiceLineSchema = new Schema(
  {
    description: { type: String, required: true },
    hsnCode: String,
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    gstRate: { type: Number, required: true },
    taxableValue: { type: Number, required: true },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },
    lineTotal: { type: Number, required: true },
  },
  { _id: false }
);

/**
 * A tax invoice against a dispatched order.
 *
 * Everything on it is a copy, not a reference — the seller's GSTIN, the
 * clinic's name and address, each drip's price, HSN code and rate. A price
 * that changes next month must not rewrite a bill already issued and filed,
 * and a clinic that moves premises must not alter where last quarter's supply
 * was made. A reference would do both.
 *
 * One per order, enforced by the index: an invoice number is handed out once
 * and then stands, so pressing Download twice cannot mint a second number
 * against the same supply.
 */
const InvoiceSchema = new Schema(
  {
    invoiceNo: { type: String, required: true, unique: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    orderNo: { type: String, required: true },
    clinicId: { type: Schema.Types.ObjectId, ref: "User", index: true },

    issuedAt: { type: Date, default: Date.now },
    /** When the goods actually left, which is the date the supply was made. */
    suppliedAt: Date,

    seller: { type: PartySchema, required: true },
    buyer: { type: PartySchema, required: true },

    /**
     * "tax_invoice" only when we are registered and something was actually
     * taxed. Otherwise it is a bill of supply, and it must not call itself
     * anything else — the heading is a claim about our registration.
     */
    documentType: { type: String, enum: ["tax_invoice", "bill_of_supply"], default: "tax_invoice" },

    /** Where the supply is taxed. Drives the CGST/SGST against IGST split. */
    placeOfSupply: String,
    interState: { type: Boolean, default: false },
    /** Recorded so an old invoice can still be explained if the rule changes. */
    pricesIncludeGst: { type: Boolean, default: true },
    /** Snapshot, like everything else: terms agreed then are the terms owed. */
    terms: String,

    lines: { type: [InvoiceLineSchema], default: [] },

    taxableTotal: { type: Number, default: 0 },
    cgstTotal: { type: Number, default: 0 },
    sgstTotal: { type: Number, default: 0 },
    igstTotal: { type: Number, default: 0 },
    roundOff: { type: Number, default: 0 },
    grandTotal: { type: Number, default: 0 },

    /** The batches supplied, so the bill and the recall trail agree. */
    batches: [String],
  },
  { timestamps: true }
);

export const Invoice = models.Invoice || model("Invoice", InvoiceSchema);
export default Invoice;
