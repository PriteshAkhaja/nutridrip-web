"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import type { Payee } from "@/lib/billing/settings";

/**
 * Where clinics pay NutriDrip for an order. A clinic that pays first sees these
 * on every order waiting for payment, so they are its only instructions.
 */
export function PayeeForm({ payee }: { payee: Payee }) {
  const router = useRouter();
  const [form, setForm] = useState<Payee>(payee);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const set = (k: keyof Payee) => (e: { target: { value: string } }) => {
    setSaved(false);
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };
  const changed = (Object.keys(form) as Array<keyof Payee>).some((k) => form[k] !== payee[k]);

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/billing/payee", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not save that");
      else {
        setForm(json.data.payee);
        setSaved(true);
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="p-6">
      <h2 className="t-h3">Where clinics pay</h2>
      <p className="t-body text-[var(--color-ink-2)] mt-1 max-w-[62ch]">
        A clinic pays for each order before it is confirmed, unless it is on credit. These details are shown on every
        order waiting for payment.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 mt-5">
        <Input label="UPI ID" hint="e.g. nutridrip@hdfcbank" mono value={form.upiId} onChange={set("upiId")} />
        <Input label="Account name" value={form.accountName} onChange={set("accountName")} />
        <Input label="Bank" value={form.bankName} onChange={set("bankName")} />
        <Input label="Account number" mono inputMode="numeric" value={form.accountNo} onChange={set("accountNo")} />
        <Input
          label="IFSC"
          mono
          value={form.ifsc}
          onChange={(e) => set("ifsc")({ target: { value: e.target.value.toUpperCase() } })}
        />
      </div>

      {error ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3 mt-5">
          <span className="t-body text-[var(--color-ink-2)]">{error}</span>
        </div>
      ) : null}

      <div className="flex items-center gap-4 mt-6">
        <Button size="md" loading={busy} disabled={!changed} onClick={save}>
          Save
        </Button>
        {saved ? <span className="t-small text-[var(--color-safe-text)]">Saved</span> : null}
      </div>
    </Card>
  );
}
