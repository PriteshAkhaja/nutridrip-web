import { connectDB } from "@/lib/db/mongoose";
import { Payment } from "@/lib/models";

/**
 * What the Payments page filters on, in one place, so the nav badge and the
 * "Needs attention" view can never count different things.
 */

/** A payment whose apply has been "in progress" this long has stalled (a crash, a timeout). */
const STALLED_MS = 5 * 60_000;

export type LedgerView = "all" | "attention" | "refunds" | "unpaid";

export const LEDGER_VIEWS: Array<{ key: LedgerView; label: string }> = [
  { key: "all", label: "All" },
  { key: "attention", label: "Needs attention" },
  { key: "refunds", label: "Refunds" },
  { key: "unpaid", label: "Not completed" },
];

export function parseView(raw: string | undefined): LedgerView {
  return LEDGER_VIEWS.some((v) => v.key === raw) ? (raw as LedgerView) : "all";
}

export function ledgerFilter(view: LedgerView, now = new Date()): Record<string, unknown> {
  switch (view) {
    case "attention":
      return {
        $or: [
          { attention: { $exists: true, $ne: null } },
          { "apply.state": "pending", "apply.lockAt": { $lt: new Date(now.getTime() - STALLED_MS) } },
        ],
      };
    case "refunds":
      return { "refunds.0": { $exists: true } };
    case "unpaid":
      // Checkouts opened and never paid, or paid attempts that failed.
      return { status: { $in: ["created", "failed"] } };
    default:
      return { status: { $ne: "created" } };
  }
}

export async function attentionCount(): Promise<number> {
  await connectDB();
  return Payment.countDocuments(ledgerFilter("attention"));
}
