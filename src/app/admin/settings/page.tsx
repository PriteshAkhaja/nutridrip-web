import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guard";
import { adminNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { getClockFormat } from "@/lib/settings/clock";
import { ClockForm } from "./ClockForm";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requirePermission("settings.manage");
  const [nav, clockFormat] = await Promise.all([adminNav(), getClockFormat()]);

  return (
    <ConsoleShell
      session={session}
      roleLabel="Super admin"
      nav={nav}
      activeHref="/admin/settings"
      breadcrumb={["Admin", "Settings"]}
      title="Settings"
      meta="Whole platform"
    >
      <p className="t-body text-[var(--color-ink-2)] max-w-[76ch] mb-6" style={{ textWrap: "pretty" }}>
        Choices that apply to every screen for every role at once. A change here is recorded in the audit trail.
      </p>

      <ClockForm format={clockFormat} />
    </ConsoleShell>
  );
}
