"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Field";

/** Sharing is the act that puts a plan on a nurse's schedule. */
export function ShareToggle({
  planId,
  shared,
  nurseId,
  nurses,
}: {
  planId: string;
  shared: boolean;
  nurseId: string | null;
  nurses: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState(nurseId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/plans/${planId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "That did not go through");
      else router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  if (shared) {
    return (
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span className="t-small text-[var(--color-ink-2)]">
          Shared — the nurse sees every session on their schedule.
        </span>
        <Button size="sm" variant="secondary" loading={busy} onClick={() => patch({ sharedWithNurse: false })}>
          Unshare
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 items-end flex-wrap">
        <div className="flex-1 min-w-[180px]">
          <Select label="Share with" value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="">Choose a nurse…</option>
            {nurses.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </Select>
        </div>
        <Button
          size="sm"
          loading={busy}
          disabled={!choice}
          onClick={() => patch({ nurseId: choice, sharedWithNurse: true })}
        >
          Share
        </Button>
      </div>
      {error && <span className="t-small text-[var(--color-critical-text)]">{error}</span>}
    </div>
  );
}
