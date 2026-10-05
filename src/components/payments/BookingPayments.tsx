import { connectDB } from "@/lib/db/mongoose";
import { Payment } from "@/lib/models";
import { Pill } from "@/components/ui/Pill";
import { formatDate } from "@/lib/data/inventory";
import { inrFromPaise, PURPOSE_LABEL, refundedOf } from "@/lib/payments/rules";
import type { RefundEntry } from "@/lib/payments/refunds";
import { getClockFormat } from "@/lib/settings/clock";
import { clock } from "@/lib/time";
import { SessionMoney } from "./SessionMoney";
import { paymentsSetup } from "@/lib/payments/config";

/**
 * Every payment on a session, as receipts: what it was for, how it was paid,
 * its receipt number, and every refund against it with where it has got to --
 * what a patient needs in front of them when they ring their bank, or us.
 */
export async function BookingPayments({
  booking,
  payOnline,
}: {
  booking: {
    id: string;
    status: string;
    paymentStatus?: string;
    amount?: number;
    paidAmount?: number;
    refundedAmount?: number;
    owedFees?: number;
  };
  payOnline: boolean;
}) {
  await connectDB();
  const clockFmt = await getClockFormat();
  const instantRefunds = paymentsSetup().refundSpeed === "optimum";
  const payments = await Payment.find({
    bookingId: booking.id,
    status: { $in: ["paid", "partially_refunded", "refunded"] },
  })
    .sort({ paidAt: 1, createdAt: 1 })
    .select("receiptNo purpose amount methodLabel paidAt refunds")
    .lean<
      Array<{
        _id: unknown;
        receiptNo: string;
        purpose: string;
        amount: number;
        methodLabel?: string;
        paidAt?: Date;
        refunds?: RefundEntry[];
      }>
    >();

  // Only what asks something of the patient -- a balance, an unpaid fee. The
  // rest of the story is in the receipts below.
  const asks = booking.paymentStatus === "balance_due" || (booking.owedFees ?? 0) > 0;
  const action = asks ? (
    <SessionMoney
      instantRefunds={instantRefunds}
      bookingId={booking.id}
      status={booking.status}
      paymentStatus={booking.paymentStatus === "balance_due" ? "balance_due" : "unpaid"}
      amount={booking.amount ?? 0}
      paidAmount={booking.paidAmount ?? 0}
      refundedAmount={booking.refundedAmount ?? 0}
      owedFees={booking.owedFees ?? 0}
      payOnline={payOnline}
    />
  ) : null;
  if (!payments.length) return action;

  const stamp = (d?: Date) => (d ? `${formatDate(d)}, ${clock(d, clockFmt)}` : "—");
  const total = payments.reduce((n, p) => n + p.amount, 0);
  const back = payments.reduce((n, p) => n + refundedOf(p.refunds), 0);

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="t-micro">Payments &amp; receipts</span>
        <span className="t-small text-[var(--color-ink-3)]">
          {inrFromPaise(total)} paid{back ? ` · ${inrFromPaise(back)} back` : ""}
        </span>
      </div>
      <div className="flex flex-col gap-3 mt-3">
        {payments.map((p) => {
          const stillOwed = refundedOf(p.refunds) < p.amount;
          return (
            <div
              key={String(p._id)}
              className="rounded-[14px] border border-[var(--color-line)] bg-[var(--color-surface-2)] overflow-hidden"
            >
              <div className="px-4 pt-3 pb-3 flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="t-body font-semibold">{PURPOSE_LABEL[p.purpose] ?? "Payment"}</span>
                  <span className="t-data text-[15px]">{inrFromPaise(p.amount)}</span>
                </div>
                <span className="t-small text-[var(--color-ink-2)]">
                  {p.methodLabel ?? "Online"} · {stamp(p.paidAt)}
                </span>
                <span className="inline-flex self-start mt-1 px-2 py-[2px] rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] t-data text-[12px] text-[var(--color-ink-2)]">
                  {p.receiptNo}
                </span>
              </div>
              {(p.refunds ?? [])
                // A failed attempt matters only while that money has still not gone back.
                .filter((r) => r.status !== "failed" || stillOwed)
                .map((r, i) => (
                  <div
                    key={i}
                    className="border-t border-dashed border-[var(--color-line-2)] px-4 py-3 flex flex-col gap-1 bg-[var(--color-surface)]"
                  >
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="t-small text-[var(--color-ink-2)] inline-flex items-center gap-2">
                        <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path
                            d="M5.5 3.5 3 6l2.5 2.5M3 6h6.5a3.5 3.5 0 010 7H7"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        Refund
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <span className="t-data text-[13.5px]">{inrFromPaise(r.amount)}</span>
                        {r.status === "processed" ? (
                          <Pill tone="safe">Refunded</Pill>
                        ) : r.status === "pending" ? (
                          <Pill tone="info" dot>
                            On its way
                          </Pill>
                        ) : (
                          <Pill tone="caution">Being arranged</Pill>
                        )}
                      </span>
                    </div>
                    <span className="t-small text-[var(--color-ink-3)]">
                      {r.status === "processed"
                        ? `Sent ${stamp(r.processedAt ?? r.at)}${r.arn ? ` · bank reference ${r.arn}` : ""}`
                        : r.status === "pending"
                          ? `Started ${stamp(r.at)} · usually 5–7 working days to show`
                          : "It could not go back automatically; the team has been told and is sending it."}
                    </span>
                  </div>
                ))}
            </div>
          );
        })}
      </div>
      {action}
    </div>
  );
}
