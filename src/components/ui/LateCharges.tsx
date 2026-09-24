import { inr } from "@/lib/billing/late-policy";

type Charge = {
  kind: "late_reschedule" | "late_cancel";
  amount: number;
  at: string;
  note: string | null;
  settledAs?: "paid" | "waived" | null;
};

/**
 * "Moved late · ₹500 — added to this session", under a session a patient moved
 * or cancelled inside the late window. What they owe is said where the session
 * is, not only on a bill that does not exist yet. Renders nothing without fees.
 */
export function LateCharges({ charges }: { charges?: Charge[] | null }) {
  if (!charges?.length) return null;
  const owed = charges.filter((c) => !c.settledAs);
  const total = owed.reduce((sum, c) => sum + c.amount, 0);
  // Amber while something is owed; quiet once it is all paid or waived.
  const settled = owed.length === 0;
  return (
    <div
      className={`rounded-[var(--radius-sm)] border px-3 py-2 mt-3 flex flex-col gap-1 ${
        settled ? "border-[var(--color-line)] bg-[var(--color-surface-2)]" : "border-[var(--color-caution)] bg-[var(--color-caution-soft)]"
      }`}
    >
      {charges.map((c, i) => (
        <div key={i} className="flex items-baseline justify-between gap-3">
          <span className="t-small text-[var(--color-ink-2)] min-w-0">
            <span className="font-semibold text-[var(--color-ink)]">
              {c.kind === "late_reschedule" ? "Moved late" : "Cancelled late"}
            </span>{" "}
            ·{" "}
            {new Date(c.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}
          </span>
          <span className="t-data text-[13px] flex-none">
            {inr(c.amount)}
            {c.settledAs ? <span className="t-small text-[var(--color-ink-2)]"> · {c.settledAs === "paid" ? "Paid" : "Waived"}</span> : null}
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
