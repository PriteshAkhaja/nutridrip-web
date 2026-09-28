"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

async function patch(id: string, body: object): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/calls/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return json.success ? { ok: true } : { ok: false, error: json.error ?? "That did not work" };
  } catch {
    return { ok: false, error: "Could not reach the server. Nothing changed." };
  }
}

/** The physician's half of a call: they reached the patient, or they did not. */
export function CallOutcome({ id, due, opensAt }: { id: string; due: boolean; opensAt: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"done" | "no_answer" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mark = async (action: "done" | "no_answer") => {
    setBusy(action);
    setError(null);
    const r = await patch(id, { action });
    setBusy(null);
    if (r.ok) router.refresh();
    else setError(r.error ?? null);
  };

  if (!due) return <span className="t-small text-[var(--color-ink-3)]">Mark from {opensAt}</span>;
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2 flex-wrap justify-end">
        <Button size="sm" loading={busy === "done"} onClick={() => mark("done")}>
          Called
        </Button>
        <Button size="sm" variant="secondary" loading={busy === "no_answer"} onClick={() => mark("no_answer")}>
          No answer
        </Button>
      </div>
      {error && <span className="t-small text-[var(--color-critical-text)] max-w-[280px] text-right">{error}</span>}
    </div>
  );
}

/** The super admin's hand-over: the same call, another physician. */
export function HandOver({ id, doctors }: { id: string; doctors: Array<{ id: string; name: string }> }) {
  const router = useRouter();
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = async () => {
    setBusy(true);
    setError(null);
    const r = await patch(id, { action: "handover", doctorId: to });
    setBusy(false);
    if (r.ok) router.refresh();
    else setError(r.error ?? null);
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2 items-center flex-wrap justify-end">
        <select
          aria-label="Hand to"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="min-h-[36px] rounded-[var(--radius-sm)] border border-[var(--color-line-2)] bg-[var(--color-surface)] px-2 text-[13px]"
        >
          <option value="">Hand to…</option>
          {doctors.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <Button size="sm" variant="secondary" disabled={!to} loading={busy} onClick={go}>
          Hand over
        </Button>
      </div>
      {error && <span className="t-small text-[var(--color-critical-text)] max-w-[280px] text-right">{error}</span>}
    </div>
  );
}
