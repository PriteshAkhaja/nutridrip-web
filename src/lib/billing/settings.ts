import { connectDB } from "@/lib/db/mongoose";
import { BillingSettings } from "@/lib/models";
import { LATE_POLICY_DEFAULTS, tidyPolicy, type LatePolicy } from "./late-policy";

export type BillingConfig = {
  /** The switch. Off, and no invoice carries tax of any kind. */
  gstEnabled: boolean;
  gstin: string;
  address: string;
  terms: string;
};

/**
 * Off until somebody turns it on.
 *
 * Deliberately not "12% and a placeholder number". Claiming a registration we
 * do not have is a fabricated document, and a default that looked configured
 * could never have been switched off — a blank would just fall back to it.
 */
export const BILLING_DEFAULTS: BillingConfig = {
  gstEnabled: false,
  gstin: "",
  address: "",
  terms: "Payable within 30 days of the invoice date.",
};

/**
 * Whether tax may be charged at all.
 *
 * Both halves are required. The switch is the intent; the GSTIN is the
 * authority. A supplier without a registration number may not charge GST no
 * matter how the switch is set, so this is the single question every invoice
 * asks rather than each caller deciding for itself.
 */
export function chargesGst(config: BillingConfig): boolean {
  return config.gstEnabled && config.gstin.trim().length > 0;
}

/** A failure returns the defaults, so an invoice is never blocked by a read. */
export async function getBillingConfig(): Promise<BillingConfig> {
  try {
    await connectDB();
    const row = await BillingSettings.findOne({ singleton: "billing" }).lean<Partial<BillingConfig> | null>();
    if (!row) return { ...BILLING_DEFAULTS };
    return {
      gstEnabled: row.gstEnabled ?? BILLING_DEFAULTS.gstEnabled,
      gstin: row.gstin ?? BILLING_DEFAULTS.gstin,
      address: row.address ?? BILLING_DEFAULTS.address,
      terms: row.terms?.trim() || BILLING_DEFAULTS.terms,
    };
  } catch (err) {
    console.error("getBillingConfig() fell back to defaults:", err);
    return { ...BILLING_DEFAULTS };
  }
}

/**
 * The late-change fees and window, as set on the Billing page. A failure
 * returns the defaults, so a patient is never blocked from moving a session by
 * a settings read.
 */
export async function getLatePolicy(): Promise<LatePolicy> {
  try {
    await connectDB();
    const row = await BillingSettings.findOne({ singleton: "billing" })
      .select("lateWindowHours lateRescheduleFee lateCancelFee")
      .lean<{ lateWindowHours?: number; lateRescheduleFee?: number; lateCancelFee?: number } | null>();
    return tidyPolicy({
      windowHours: row?.lateWindowHours,
      rescheduleFee: row?.lateRescheduleFee,
      cancelFee: row?.lateCancelFee,
    });
  } catch (err) {
    console.error("getLatePolicy() fell back to defaults:", err);
    return { ...LATE_POLICY_DEFAULTS };
  }
}

/** Where a clinic pays NutriDrip for an order. Every part optional: blank ones are not shown. */
export type Payee = {
  upiId: string;
  accountName: string;
  bankName: string;
  accountNo: string;
  ifsc: string;
};

export const EMPTY_PAYEE: Payee = { upiId: "", accountName: "", bankName: "", accountNo: "", ifsc: "" };

/** Anything at all to tell a clinic? */
export const hasPayee = (p: Payee) => Boolean(p.upiId || p.accountNo);

export async function getPayee(): Promise<Payee> {
  try {
    await connectDB();
    const row = await BillingSettings.findOne({ singleton: "billing" })
      .select("payeeUpiId payeeAccountName payeeBankName payeeAccountNo payeeIfsc")
      .lean<{ payeeUpiId?: string; payeeAccountName?: string; payeeBankName?: string; payeeAccountNo?: string; payeeIfsc?: string } | null>();
    return {
      upiId: row?.payeeUpiId?.trim() ?? "",
      accountName: row?.payeeAccountName?.trim() ?? "",
      bankName: row?.payeeBankName?.trim() ?? "",
      accountNo: row?.payeeAccountNo?.trim() ?? "",
      ifsc: row?.payeeIfsc?.trim() ?? "",
    };
  } catch (err) {
    console.error("getPayee() fell back to empty:", err);
    return { ...EMPTY_PAYEE };
  }
}
