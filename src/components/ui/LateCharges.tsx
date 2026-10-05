"use client";

import { inr } from "@/lib/billing/late-policy";
import { useClockFormat } from "@/components/ClockProvider";
import { shortDateClock } from "@/lib/time";

type Charge = {
  kind: "late_reschedule" | "late_cancel";
  amount: number;
  at: string;
  note: string | null;
  settledAs?: "paid" | "waived" | null;
  /** "deducted": kept from a late cancellation's refund; "online": paid through Razorpay. */
  paidMethod?: string | null;
};

/**
 * "Moved late · ₹500 — added to this session", under a session a patient moved
 * or cancelled inside the late window. What they owe is said where the session
 * is, not only on a bill that does not exist yet. Renders nothing without fees.
 */
export function LateCharges({ charges }: { charges?: Charge[] | null }) {
  const clockFmt = useClockFormat();
  if (!charges?.length) return null;
  const owed = charges.filter((c) => !c.settledAs);
  const total = owed.reduce((sum, c) => sum + c.amount, 0);
  // Amber while something is owed; quiet once it is all paid or waived.
  const settled = owed.length === 0;
  return (
    <div
      className={`rounded-[14px] border px-3 py-3 mt-3 flex flex-col gap-2 ${
        settled
          ? "border-[var(--color-line)] bg-[var(--color-surface-2)]"
          : "border-[var(--color-caution)] bg-[var(--color-caution-soft)]"
      }`}
    >
      {charges.map((c, i) => (
        // What happened and when on the left; the amount and how it was settled on the right.
        <div key={i} className="flex items-start justify-between gap-3">
          <span className="min-w-0 flex flex-col">
            <span className="t-small font-semibold text-[var(--color-ink)]">
              {c.kind === "late_reschedule" ? "Moved late" : "Cancelled late"}
            </span>
            <span className="t-small text-[var(--color-ink-3)]">{shortDateClock(c.at, clockFmt)}</span>
          </span>
          <span className="flex flex-col items-end flex-none text-right">
            <span className="t-data text-[13px]">{inr(c.amount)}</span>
            {c.settledAs ? (
              <span className="t-small text-[var(--color-ink-2)]">
                {c.settledAs === "waived"
                  ? "Waived"
                  : c.paidMethod === "deducted"
                    ? "Kept from your refund"
                    : c.paidMethod === "online"
                      ? "Paid online"
                      : "Paid"}
              </span>
            ) : null}
          </span>
        </div>
      ))}
      <span className="t-small text-[var(--color-ink-2)]">
        {settled
          ? "Late-change fee settled — nothing more to pay."
          : owed.length > 1
            ? `${inr(total)} in late-change fees, added to this session.`
            : "Late-change fee, added to this session."}
      </span>
    </div>
  );
}
