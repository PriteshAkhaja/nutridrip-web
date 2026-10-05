"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { DatePicker } from "@/components/ui/DatePicker";
import { PAY_METHODS, PAY_METHOD_LABEL, referenceProblem } from "@/lib/billing/order-payment";

type ManualMethod = (typeof PAY_METHODS)[number];

/**
 * The team records a credit invoice paid outside the app: how, the reference
 * the bank shows, and the day the money arrived. (Paid online, an invoice
 * marks itself paid.)
 */
export function RecordPayment({ orderId, today }: { orderId: string; today: string }) {
  const router = useRouter();
  const [method, setMethod] = useState<ManualMethod>("bank_transfer");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(today);
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
      const res = await fetch(`/api/invoices/${orderId}/payment`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ method, reference, paidOn }),
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
    <div className="flex flex-col gap-4 mt-4">
      <div role="radiogroup" aria-label="How it was paid" className="flex gap-2 flex-wrap">
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Input
          label={method === "cheque" ? "Cheque number" : method === "upi" ? "UPI reference" : "UTR number"}
          mono
          value={reference}
          error={touched ? (problem ?? undefined) : undefined}
          onChange={(e) => setReference(e.target.value)}
        />
        <DatePicker label="Date received" max={today} value={paidOn} onChange={setPaidOn} clearable={false} />
      </div>
      {error && <span className="t-small text-[var(--color-critical-text)]">{error}</span>}
      <div>
        <Button loading={busy} onClick={submit}>
          Mark as paid
        </Button>
      </div>
    </div>
  );
}
