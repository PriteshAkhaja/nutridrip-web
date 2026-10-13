import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guard";
import { adminNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { getClockFormat } from "@/lib/settings/clock";
import { getNurseDayLimit } from "@/lib/settings/nurse-day";
import { getBrandColor, getContrastColor, getDeepColor } from "@/lib/settings/theme";
import { ClockForm } from "./ClockForm";
import { NurseDayForm } from "./NurseDayForm";
import { BrandForm } from "./BrandForm";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await requirePermission("settings.manage");
  const [nav, clockFormat, nurseDayLimit, brandColor] = await Promise.all([
    adminNav(),
    getClockFormat(),
    getNurseDayLimit(),
    getBrandColor(),
  ]);
  const [deepColor, contrastColor] = await Promise.all([getDeepColor(), getContrastColor()]);

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

      <div className="flex flex-col gap-6">
        <ClockForm format={clockFormat} />
        <NurseDayForm limit={nurseDayLimit} />
        <BrandForm color={brandColor} deep={deepColor} contrast={contrastColor} />
      </div>
    </ConsoleShell>
  );
}
