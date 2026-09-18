"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * Closing a plan out.
 *
 * Five statuses existed and two were reachable, so a four-week course whose
 * last session ran in March still read "Active" today and could not be tidied
 * away. These are the other three.
 *
 * Each button is styled for what it does, not for where it sits: archiving and
 * completing are real actions and look like it; deleting proposes removing
 * something and is outlined in red; only the confirmation itself is solid.
 *
 * Both confirmations are worded, not "Are you sure?". The sentence carries the
 * part somebody needs to read — what happens, to whom, and whether it can be
 * undone. Completing can be; deleting cannot, and each says so.
 */
type Pending = { to: string; title: string; body: string; cta: string; grave: boolean } | null;

export function PlanActions({
  planId,
  status,
  shared,
  patientName,
}: {
  planId: string;
  status: string;
  shared: boolean;
  patientName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);

  const run = async (to: string) => {
    setBusy(to);
    setError(null);
    try {
      const res = await fetch(`/api/plans/${planId}`, {
        method: to === "delete" ? "DELETE" : "PATCH",
        ...(to === "delete"
          ? {}
          : {
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ status: to }),
            }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not do that");
      else router.refresh();
    } catch {
      setError("Could not reach the server. Nothing changed.");
    } finally {
      setBusy(null);
      setPending(null);
    }
  };

  const canDelete = status === "draft" && !shared;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-3 flex-wrap items-center">
        {status === "active" ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              setPending({
                to: "completed",
                title: `Mark ${patientName}'s course complete?`,
                body: shared
                  ? "It stays on your list and on the nurse's, marked Completed. You can reopen it if more sessions are needed."
                  : "It will read Completed rather than Active. You can reopen it if more sessions are needed.",
                cta: "Mark it complete",
                grave: false,
              })
            }
          >
            Mark complete
          </Button>
        ) : null}

        {status !== "archived" && status !== "draft" ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              setPending({
                to: "archived",
                title: `Archive ${patientName}'s plan?`,
                body: shared
                  ? "It comes off the nurse's schedule and the patient's home screen, and both are told. The record stands, and you can reopen it."
                  : "It leaves your Open list and moves to Archived. The record stands, and you can reopen it.",
                cta: "Archive it",
                grave: false,
              })
            }
          >
            Archive
          </Button>
        ) : null}

        {status === "archived" ? (
          <Button size="sm" variant="secondary" loading={busy === "active"} onClick={() => run("active")}>
            Reopen
          </Button>
        ) : null}

        {canDelete ? (
          <Button
            size="sm"
            variant="destructive"
            onClick={() =>
              setPending({
                to: "delete",
                title: `Delete this draft for ${patientName}?`,
                body: "It has never been shared, so nobody else has seen it. This cannot be undone.",
                cta: "Delete it",
                grave: true,
              })
            }
          >
            Delete
          </Button>
        ) : null}
      </div>

      {pending ? (
        <div
          className={`rounded-[var(--radius-md)] border px-4 py-3 ${
            pending.grave
              ? "border-[var(--color-critical)] bg-[var(--color-critical-soft)]"
              : "border-[var(--color-line-2)] bg-[var(--color-surface-2)]"
          }`}
        >
          <p className="t-body font-medium">{pending.title}</p>
          <p className="t-small text-[var(--color-ink-2)] mt-1">{pending.body}</p>
          <div className="flex gap-3 mt-3">
            <Button
              size="sm"
              variant={pending.grave ? "danger" : "primary"}
              loading={busy === pending.to}
              onClick={() => run(pending.to)}
            >
              {pending.cta}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {error ? <p className="t-small text-[var(--color-critical-text)]">{error}</p> : null}
    </div>
  );
}
