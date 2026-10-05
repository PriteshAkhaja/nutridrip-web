"use client";

import type { ReactNode } from "react";
import { PayButton } from "./PayButton";
import { inr } from "@/lib/billing/late-policy";

/**
 * A session's money in one row, where the session is: paid, a balance to pay,
 * a refund on its way (with where it has got to), refunded. With something to
 * pay and online payment on, the button to pay it sits right there.
 *
 * Renders nothing for a session with no money on it (booked before online
 * payment, or with it off, and nothing owed).
 */
export function SessionMoney({
  bookingId,
  status,
  paymentStatus,
  amount,
  paidAmount,
  refundedAmount,
  owedFees = 0,
  payOnline,
  instantRefunds = false,
}: {
  bookingId: string;
  status: string;
  paymentStatus: string;
  /** Rupees: what the session costs now. */
  amount: number;
  /** Rupees paid for the session (drip price and any balance), before refunds. */
  paidAmount: number;
  /** Rupees refunded or on the way, all of it. */
  refundedAmount: number;
  /** Rupees of late-change fees still owed. */
  owedFees?: number;
  payOnline: boolean;
  /** Refunds are sent at Razorpay's "optimum" speed: instant wherever the bank allows. */
  instantRefunds?: boolean;
}) {
  const ended = status === "cancelled" || status === "rejected";
  // A session marked paid before amounts were recorded is paid in full.
  const paid = paidAmount > 0 ? paidAmount : paymentStatus === "paid" ? amount : 0;
  const balance = Math.max(0, amount - (paid - Math.min(refundedAmount, paid)));
  const kept = Math.max(0, paid - refundedAmount);

  const feeRow =
    payOnline && owedFees > 0 ? (
      <Row
        tone="caution"
        icon="due"
        title={`${inr(owedFees)} in late-change fees`}
        detail="From a change made inside the late window."
        action={
          <PayButton
            size="sm"
            variant="secondary"
            lock={false}
            successTitle="Fees paid"
            request={{ purpose: "late_fee", bookingId }}
          >
            Pay {inr(owedFees)}
          </PayButton>
        }
      />
    ) : null;

  switch (paymentStatus) {
    case "paid":
      return (
        <>
          <Row
            tone="safe"
            icon="paid"
            title="Paid"
            amount={inr(paid)}
            detail={`${refundedAmount > 0 ? `${inr(refundedAmount)} of it has been refunded to you. ` : ""}${
              status === "completed" || status === "in_progress"
                ? "Paid in full for this session."
                : "Refunded automatically if the session does not go ahead."
            }`}
          />
          {feeRow}
        </>
      );
    case "balance_due":
      return (
        <Row
          tone="caution"
          icon="due"
          title={`${inr(balance)} to pay`}
          detail="Your physician switched you to a drip that costs more. Pay the difference before the nurse arrives."
          action={
            payOnline && !ended ? (
              <PayButton
                size="sm"
                successTitle="Balance paid"
                finishing="Recording your payment"
                request={{ purpose: "booking_balance", bookingId }}
              >
                Pay {inr(balance)}
              </PayButton>
            ) : null
          }
        />
      );
    case "refund_pending":
      // Owed but not yet sent (Razorpay refused the first try): say so, rather
      // than "on its way" with ₹0. The team retries it from Payments.
      if (refundedAmount <= 0) {
        return (
          <Row
            tone="caution"
            icon="refund"
            title="Your refund is being arranged"
            detail="We could not send it back automatically this minute. The team has been told and will send it — you do not need to do anything."
          />
        );
      }
      return (
        <Row
          tone="info"
          icon="refund"
          title="Refund on its way"
          amount={inr(refundedAmount)}
          detail="To the account you paid from."
        >
          <RefundTracker instant={instantRefunds} />
        </Row>
      );
    case "partially_refunded":
      return (
        <Row
          tone="neutral"
          icon="refund"
          title="Refunded"
          amount={inr(refundedAmount)}
          detail={`${inr(kept)} was kept as the late-cancellation fee.`}
        />
      );
    case "refunded":
      return (
        <Row
          tone="neutral"
          icon="refund"
          title="Refunded"
          amount={inr(refundedAmount)}
          detail="Back in the account you paid from."
        />
      );
    default:
      return feeRow;
  }
}

const TONES = {
  safe: { ring: "var(--color-safe)", bg: "var(--color-safe-soft)", fg: "var(--color-safe-text)" },
  info: { ring: "var(--color-info)", bg: "var(--color-info-soft)", fg: "var(--color-info-text)" },
  caution: { ring: "var(--color-caution)", bg: "var(--color-caution-soft)", fg: "var(--color-caution-text)" },
  neutral: { ring: "var(--color-line-2)", bg: "var(--color-surface)", fg: "var(--color-ink-2)" },
} as const;

/** One money row: a mark, what it is, the amount, and -- when there is something to do -- the button. */
function Row({
  tone,
  icon,
  title,
  detail,
  amount,
  action,
  children,
}: {
  tone: keyof typeof TONES;
  icon: "paid" | "due" | "refund";
  title: string;
  detail?: string;
  amount?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <div className="mt-3 rounded-[14px] border border-[var(--color-line)] bg-[var(--color-surface-2)] px-3 py-3 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="w-8 h-8 rounded-full inline-flex items-center justify-center flex-none border"
          style={{ borderColor: t.ring, background: t.bg, color: t.fg }}
        >
          {icon === "paid" ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M3 7.3 5.8 10 11 4.2"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : icon === "refund" ? (
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path
                d="M5.5 3.5 3 6l2.5 2.5M3 6h6.5a3.5 3.5 0 010 7H7"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 3.2v4.4M7 10.3v.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </span>
        <div className="min-w-0 flex-1 flex flex-col gap-[2px]">
          <div className="flex items-baseline justify-between gap-3">
            <span className="t-body font-semibold">{title}</span>
            {amount && <span className="t-data text-[14.5px] flex-none">{amount}</span>}
          </div>
          {detail && <span className="t-small text-[var(--color-ink-2)]">{detail}</span>}
        </div>
      </div>
      {children}
      {action && <div className="flex flex-col gap-1 sm:items-start pl-11">{action}</div>}
    </div>
  );
}

/** Where a refund has got to: started, with the bank (now, pulsing), in the account. */
function RefundTracker({ instant }: { instant: boolean }) {
  const steps = [
    { label: "Started", state: "done" },
    { label: "With your bank", state: "now" },
    { label: "In your account", state: "next" },
  ] as const;
  return (
    <div className="pl-11">
      <div
        className="relative grid grid-cols-3 gap-x-2"
        aria-label="Refund progress: started, now with your bank, then back in your account"
      >
        {/* The rail behind the dots, filled up to the step it is on. */}
        <span
          aria-hidden
          className="absolute left-[16.66%] right-[16.66%] top-[7px] h-[2px] rounded-full bg-[var(--color-line-2)]"
        />
        <span
          aria-hidden
          className="absolute left-[16.66%] w-[33.33%] top-[7px] h-[2px] rounded-full bg-[var(--color-info)]"
        />
        {steps.map((s) => (
          <div key={s.label} className="relative flex flex-col items-center gap-[6px] text-center">
            <span
              aria-hidden
              className={`w-4 h-4 rounded-full border-2 ${s.state === "now" ? "pay-live" : ""}`}
              style={{
                borderColor: s.state === "next" ? "var(--color-line-2)" : "var(--color-info)",
                background: s.state === "done" ? "var(--color-info)" : "var(--color-surface-2)",
              }}
            />
            <span
              className="text-[11.5px] leading-[1.3] max-w-[10ch]"
              style={{
                color: s.state === "next" ? "var(--color-ink-3)" : "var(--color-ink-2)",
                fontWeight: s.state === "now" ? 600 : 400,
              }}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>
      <span className="t-small text-[var(--color-ink-3)] block mt-2">
        {instant
          ? "Usually within minutes. If your bank cannot take an instant refund, 5–7 working days."
          : "Usually 5–7 working days, depending on your bank."}
      </span>
    </div>
  );
}
