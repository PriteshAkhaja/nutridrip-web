import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { MobileShell } from "@/components/layout/MobileShell";
import { nurseRoute } from "@/lib/data/sessions";
import { StatusPill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/States";
import { ButtonLink } from "@/components/ui/Button";
import { NURSE_TABS } from "./tabs";

export const metadata: Metadata = { title: "Today" };
export const dynamic = "force-dynamic";

/** The one action each card offers depends on where the session has got to. */
function primaryAction(status: string, id: string) {
  switch (status) {
    case "completed":
      return { label: "Report", href: `/nurse/session/${id}/report`, variant: "secondary" as const, size: "md" as const };
    case "in_progress":
      return { label: "Open checklist", href: `/nurse/session/${id}`, variant: "primary" as const, size: "lg" as const };
    default:
      return { label: "Prepare", href: `/nurse/session/${id}`, variant: "secondary" as const, size: "md" as const };
  }
}

export default async function NurseTodayPage() {
  const session = await requireRole("nurse", "superadmin");
  const route = await nurseRoute(session.sub);

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });

  return (
    <MobileShell
      title={today}
      subtitle={`${route.length} session${route.length === 1 ? "" : "s"} on your route`}
      tabs={NURSE_TABS}
      activeHref="/nurse"
    >
      {route.length === 0 ? (
        <EmptyState
          kind="cleared"
          title="Nothing on your route today"
          body="When a physician approves a protocol and dispatch assigns it to you, the session appears here with its full checklist."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {route.map((s) => {
            const action = primaryAction(s.status, s.id);
            const active = s.status === "in_progress";

            return (
              <div
                key={s.id}
                className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-5 flex flex-col gap-4"
                style={{ borderColor: active ? "var(--color-primary)" : "var(--color-line)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="t-data text-[14.5px] text-[var(--color-ink-2)]">{s.timeRange}</span>
                    <h2 className="t-h3 mt-1 truncate">{s.patientName}</h2>
                    <span className="t-small text-[var(--color-ink-3)] block truncate">{s.where}</span>
                  </div>
                  <StatusPill status={s.status} dot />
                </div>

                <div className="flex flex-col gap-1 pt-3 border-t border-[var(--color-line)]">
                  <div className="flex justify-between gap-3 items-baseline">
                    <span className="t-body text-[var(--color-ink-2)]">{s.dripName}</span>
                    {s.batches.length > 0 && (
                      <span className="t-data text-[13px] text-[var(--color-ink-3)]">{s.batches.join(" · ")}</span>
                    )}
                  </div>
                  {s.stepsTotal > 0 && (
                    <div className="flex justify-between gap-3 items-baseline">
                      <span className="t-small text-[var(--color-ink-3)]">Checklist</span>
                      <span className="t-data text-[13px]">
                        {s.stepsDone} / {s.stepsTotal}
                      </span>
                    </div>
                  )}
                </div>

                {/* Phase progress, as FillSegments */}
                {s.stepsDone > 0 && s.status !== "completed" && (
                  <div className="flex gap-[3px]">
                    {s.progress.flatMap((p) =>
                      Array.from({ length: p.total }, (_, i) => (
                        <div
                          key={`${p.phase}-${i}`}
                          className="flex-1 h-[6px] rounded-[2px]"
                          style={{
                            background: i < p.done ? "var(--color-primary)" : "var(--color-surface-2)",
                          }}
                        />
                      ))
                    )}
                  </div>
                )}

                <ButtonLink href={action.href} variant={action.variant} size={action.size} block>
                  {action.label}
                </ButtonLink>
              </div>
            );
          })}
        </div>
      )}

      <p className="t-small text-[var(--color-ink-3)] mt-6">
        Your kit is checked from the <Link href="/nurse/kit">Kit</Link> tab before the first session of the day.
      </p>
    </MobileShell>
  );
}
