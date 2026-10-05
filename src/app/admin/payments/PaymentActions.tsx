"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";

/**
 * Per payment: check it against Razorpay, and refund it by hand.
 *
 * A refund is money leaving, so it is two steps: say how much and why, then
 * confirm the sentence that says exactly what will happen.
 */
export function PaymentActions({
  paymentId,
  payerName,
  /** Paise still refundable. */
  refundable,
  canRefund,
  canCheck,
}: {
  paymentId: string;
  payerName: string;
  refundable: number;
  canRefund: boolean;
  canCheck: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [amount, setAmount] = useState(String(refundable / 100));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"refund" | "check" | null>(null);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const rupees = Number(amount);
  const amountProblem =
    !Number.isFinite(rupees) || rupees <= 0
      ? "Enter an amount"
      : Math.round(rupees * 100) > refundable
        ? `At most ₹${(refundable / 100).toLocaleString("en-IN")}`
        : null;
  const reasonProblem = reason.trim().length < 3 ? "Say why — it is kept with the refund" : null;

  const post = async (path: string, body?: unknown) => {
    const res = await fetch(path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  };

  const check = async () => {
    setBusy("check");
    setMessage(null);
    try {
      const json = await post(`/api/payments/${paymentId}/reconcile`);
      setMessage(
        json.success
          ? { tone: "ok", text: json.data?.result?.message ?? "Up to date with Razorpay." }
          : { tone: "error", text: json.error ?? "Could not check" }
      );
      router.refresh();
    } catch {
      setMessage({ tone: "error", text: "Could not reach the server." });
    } finally {
      setBusy(null);
    }
  };

  const refund = async () => {
    setBusy("refund");
    setMessage(null);
    try {
      const json = await post(`/api/payments/${paymentId}/refund`, { amount: rupees, reason: reason.trim() });
      if (!json.success) setMessage({ tone: "error", text: json.error ?? "The refund was not made" });
      else if (json.data?.outcome?.status === "failed") {
        setMessage({ tone: "error", text: `Razorpay did not make it: ${json.data.outcome.error ?? "unknown reason"}` });
      } else {
        setMessage({ tone: "ok", text: "Refund started. The payer has been told." });
        setOpen(false);
        setConfirming(false);
      }
      router.refresh();
    } catch {
      setMessage({ tone: "error", text: "Could not reach the server. Check the payment before trying again." });
    } finally {
      setBusy(null);
    }
  };

  return (
    // Capped at the refund form's width: a long Check result wraps under the
    // buttons instead of stretching the table's last column across the page.
    <div className="flex flex-col gap-2 min-w-[140px] max-w-[320px]">
      <div className="flex gap-2 flex-wrap">
        {canCheck && (
          <Button
            size="sm"
            variant="ghost"
            loading={busy === "check"}
            onClick={check}
            title="Ask Razorpay what is true, and bring this record up to date"
          >
            Check
          </Button>
        )}
        {canRefund && refundable > 0 && !open && (
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            Refund
          </Button>
        )}
      </div>

      {open && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-3 flex flex-col gap-3 w-[min(320px,80vw)] whitespace-normal">
          {!confirming ? (
            <>
              <Input
                label="Amount, ₹"
                mono
                inputMode="decimal"
                value={amount}
                error={amountProblem ?? undefined}
                onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
              />
              <Textarea
                label="Why"
                rows={2}
                value={reason}
                error={reason ? (reasonProblem ?? undefined) : undefined}
                onChange={(e) => setReason(e.target.value)}
                placeholder="A complaint, a goodwill gesture, a retry…"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  disabled={Boolean(amountProblem || reasonProblem)}
                  onClick={() => setConfirming(true)}
                >
                  Continue
                </Button>
              </div>
            </>
          ) : (
            <>
              <span className="t-body">
                Refund <span className="t-data text-[14px]">₹{rupees.toLocaleString("en-IN")}</span> to {payerName}? It
                goes back to the account they paid from, and cannot be undone.
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => setConfirming(false)}>
                  Back
                </Button>
                <Button size="sm" variant="danger" loading={busy === "refund"} onClick={refund}>
                  Refund ₹{rupees.toLocaleString("en-IN")}
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {message && (
        <span
          role={message.tone === "error" ? "alert" : "status"}
          className={`t-small whitespace-normal ${
            message.tone === "error" ? "text-[var(--color-critical-text)]" : "text-[var(--color-safe-text)]"
          }`}
        >
          {message.text}
        </span>
      )}
    </div>
  );
}
