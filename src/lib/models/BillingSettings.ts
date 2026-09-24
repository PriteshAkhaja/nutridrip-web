import { Schema, model, models } from "mongoose";

/**
 * How invoices are raised. One document, ever.
 *
 * Kept apart from ContentBlock on purpose. That module is editable *copy*, and
 * its contract is that a deleted row reverts to a bundled default so the site
 * can never render blank. A GST registration is not copy: it is configuration,
 * it has no sensible default, and inventing one would print a fabricated
 * registration number on a real invoice.
 */
const BillingSettingsSchema = new Schema(
  {
    /** Pins the collection to a single row. */
    singleton: { type: String, default: "billing", unique: true, immutable: true },

    /** The switch. Off, and nothing is ever taxed. */
    gstEnabled: { type: Boolean, default: false },
    gstin: String,
    address: String,
    terms: String,

    /**
     * Late changes by patients (see lib/billing/late-policy). Absent until set,
     * which reads as the defaults: 4 hours, ₹500 to move, ₹500 to cancel.
     */
    lateWindowHours: Number,
    lateRescheduleFee: Number,
    lateCancelFee: Number,

    /** Where clinics pay for their orders: shown to them on every unpaid order. */
    payeeUpiId: String,
    payeeAccountName: String,
    payeeBankName: String,
    payeeAccountNo: String,
    payeeIfsc: String,

    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

export const BillingSettings =
  models.BillingSettings || model("BillingSettings", BillingSettingsSchema);
export default BillingSettings;
