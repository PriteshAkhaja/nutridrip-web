"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { PAY_METHODS, PAY_METHOD_LABEL, referenceProblem, type PayMethod } from "@/lib/billing/order-payment";

/**
 * "I've paid": how, the reference the bank or UPI app shows, and the date.
 * NutriDrip checks the money has arrived before the order goes to the pharmacy.
 */
export function PayOrderForm({
  orderId,
  today,
  initial,
  submitLabel = "I've paid",
}: {
  orderId: string;
  /** YYYY-MM-DD, from the server, so the default date cannot differ after hydration. */
  today: string;
  initial?: { method: PayMethod; reference: string; paidOn: string } | null;
  submitLabel?: string;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<PayMethod>(initial?.method ?? "upi");
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [paidOn, setPaidOn] = useState(initial?.paidOn ?? today);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problem = referenceProblem(reference);

  const submit = async () => {
    setTouched(true);
    if (problem) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orders/${orderId}/payment`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "submit", method, reference, paidOn }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "That did not save");
      else router.refresh();
    } catch {
      setError("Could not reach the server. Nothing was recorded.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div role="radiogroup" aria-label="How you paid" className="flex flex-col gap-2">
        <span className="t-micro">How you paid</span>
        <div className="flex gap-2 flex-wrap">
          {PAY_METHODS.map((m) => {
            const on = method === m;
            return (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setMethod(m)}
                className="min-h-[40px] px-4 rounded-full border cursor-pointer text-[14px]"
                style={{
                  borderColor: on ? "var(--color-primary)" : "var(--color-line-2)",
                  background: on ? "var(--color-primary-soft)" : "var(--color-surface)",
                  color: on ? "var(--color-primary-dark)" : "var(--color-ink)",
                  fontWeight: on ? 600 : 400,
                }}
              >
                {PAY_METHOD_LABEL[m]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Input
          label={method === "cheque" ? "Cheque number" : method === "upi" ? "UPI reference" : "UTR number"}
          hint="as your bank or UPI app shows it"
          mono
          value={reference}
          error={touched ? (problem ?? undefined) : undefined}
          onChange={(e) => setReference(e.target.value)}
        />
        <Input label="Date paid" type="date" max={today} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />
      </div>

      {error && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3">
          <span className="t-body text-[var(--color-ink-2)]">{error}</span>
        </div>
      )}

      <div>
        <Button loading={busy} onClick={submit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
