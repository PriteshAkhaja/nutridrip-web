"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

type Pending = {
  kind: "activate" | "deactivate" | "delete";
  title: string;
  body: string;
  cta: string;
  grave: boolean;
} | null;

/**
 * What can be done to one configuration.
 *
 * Each button is styled for what it does: Edit is a link, switching status is a
 * real action, Delete proposes removing something and is outlined red, and only
 * the confirmation itself is solid. The confirmations are worded — what changes,
 * what does not, and whether it can be undone — because "Are you sure?" gives a
 * person nothing to be sure about.
 *
 * The sentence every confirmation repeats is the honest one: nothing reads these
 * settings yet, so none of this changes what a patient sees.
 */
export function StudioActions({
  id,
  name,
  status,
  activeName,
}: {
  id: string;
  name: string;
  status: "active" | "test";
  /** The model currently Active, if it is a different one. */
  activeName: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);

  const run = async (kind: "activate" | "deactivate" | "delete") => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ai/${id}`, {
        method: kind === "delete" ? "DELETE" : "PATCH",
        ...(kind === "delete"
          ? {}
          : {
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ status: kind === "activate" ? "active" : "test" }),
            }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Could not do that");
        return;
      }
      setPending(null);
      router.refresh();
    } catch {
      setError("Could not reach the server. Nothing changed.");
    } finally {
      setBusy(false);
    }
  };

  const ask = (p: NonNullable<Pending>) => {
    setError(null);
    setPending(p);
  };

  return (
    <div className="flex flex-col gap-3 items-start">
      {/* One row. Left to wrap, Delete dropped under Make active on the Test
          rows and not on the Active one, so the column looked ragged. The table
          scrolls sideways inside its own box on a narrow screen instead. */}
      <div className="flex gap-2 flex-nowrap items-center">
        <Link
          href={`/admin/studio?edit=${id}`}
          className="t-body font-semibold inline-flex items-center min-h-[36px] px-2 no-underline hover:underline"
        >
          Edit
        </Link>

        {status === "test" ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              ask({
                kind: "activate",
                title: `Make “${name}” the active model?`,
                body: `${
                  activeName ? `“${activeName}” moves back to Test. ` : ""
                }Nothing in NutriDrip reads these settings yet, so no patient-facing behaviour changes.`,
                cta: "Make it active",
                grave: false,
              })
            }
          >
            Make active
          </Button>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              ask({
                kind: "deactivate",
                title: `Move “${name}” back to Test?`,
                body: "No model will be active until you choose one. Nothing in NutriDrip reads these settings yet, so no patient-facing behaviour changes.",
                cta: "Move to Test",
                grave: false,
              })
            }
          >
            Move to Test
          </Button>
        )}

        {status === "test" ? (
          <Button
            size="sm"
            variant="destructive"
            onClick={() =>
              ask({
                kind: "delete",
                title: `Delete “${name}”?`,
                body: "The settings and prompts are removed. The full text stays in the audit trail, but this cannot be undone from here.",
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
          className={`rounded-[var(--radius-md)] border px-4 py-3 max-w-[460px] ${
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
              loading={busy}
              onClick={() => run(pending.kind)}
            >
              {pending.cta}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="t-small text-[var(--color-critical-text)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
