"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUSES = ["new", "contacted", "qualified", "converted", "closed"] as const;
const TONE: Record<string, string> = {
  new: "var(--color-info)",
  contacted: "var(--color-caution)",
  qualified: "var(--color-primary)",
  converted: "var(--color-safe)",
  closed: "var(--color-ink-3)",
};

/** The stage an enquiry is at, changed in place. */
export function LeadStatus({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const change = async (next: string) => {
    const previous = value;
    setValue(next);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const json = await res.json();
      if (!json.success) {
        setValue(previous);
        setError(json.error ?? "Could not save");
      } else router.refresh();
    } catch {
      setValue(previous);
      setError("Offline");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <select
        value={value}
        disabled={busy}
        onChange={(e) => change(e.target.value)}
        aria-label="Enquiry status"
        className="min-h-[36px] px-3 rounded-full border bg-[var(--color-surface)] text-[12px] font-medium cursor-pointer"
        style={{ borderColor: TONE[value], color: TONE[value] }}
      >
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>
      {error && <span className="t-small text-[var(--color-critical-text)]">{error}</span>}
    </div>
  );
}
