"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * Opening a report fetches the file only when asked for, so a list of twenty
 * PDFs does not ship twenty PDFs.
 */
export function ReportRow({
  id,
  fileName,
  category,
  sizeLabel,
  dateLabel,
  notes,
}: {
  id: string;
  fileName: string;
  category: string;
  sizeLabel: string;
  dateLabel: string;
  notes?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const open = async () => {
    setBusy("open");
    setError(null);
    try {
      const res = await fetch(`/api/lab-reports/${id}`);
      const json = await res.json();
      if (!json.success || !json.data.fileUrl) {
        setError(json.error ?? "That file is not available");
        return;
      }
      // Data URLs cannot be navigated to directly in every browser, so render
      // the file into a new tab as a blob instead.
      const blob = await (await fetch(json.data.fileUrl)).blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError("Could not open that file.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy("delete");
    setError(null);
    try {
      const res = await fetch(`/api/lab-reports/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not remove that");
      else router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
      setConfirming(false);
    }
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="t-body font-medium block truncate">{fileName}</span>
          <span className="t-small text-[var(--color-ink-3)] block mt-1">
            {category} · {sizeLabel}
          </span>
        </div>
        <span className="t-data text-[13px] text-[var(--color-ink-3)] flex-none">{dateLabel}</span>
      </div>

      {notes && <p className="t-body text-[var(--color-ink-2)] mt-3">{notes}</p>}

      {error && <p className="t-small text-[var(--color-critical-text)] mt-3">{error}</p>}

      {confirming ? (
        <div className="mt-4 rounded-[var(--radius-sm)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] p-3">
          <span className="t-body text-[var(--color-ink-2)]">
            Remove {fileName}? Your physician will no longer see it.
          </span>
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="secondary" block onClick={() => setConfirming(false)}>
              Keep it
            </Button>
            <Button size="sm" variant="danger" block loading={busy === "delete"} onClick={remove}>
              Remove
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2 mt-4 pt-4 border-t border-[var(--color-line)]">
          <Button size="sm" variant="secondary" loading={busy === "open"} onClick={open}>
            Open
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}
