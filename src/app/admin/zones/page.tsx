import type { Metadata } from "next";
import { requirePermission } from "@/lib/auth/guard";
import { adminNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models";
import { getZones } from "@/lib/zones-store";
import { servedZones } from "@/lib/zones";
import { ZoneEditor, type ZoneRow } from "./ZoneEditor";

export const metadata: Metadata = { title: "Service zones" };
export const dynamic = "force-dynamic";

export default async function ZonesAdminPage() {
  const session = await requirePermission("zones.manage");
  await connectDB();
  const [nav, zones, nurses] = await Promise.all([
    adminNav(),
    getZones(),
    User.find({ role: "nurse", status: "active" })
      .select("nurse.serviceAreas")
      .lean<Array<{ nurse?: { serviceAreas?: string[] } }>>(),
  ]);

  // How many active nurses cover each zone: a zone nobody covers still takes
  // bookings, and the team should see that before a patient does.
  const covering = new Map<string, number>();
  for (const n of nurses) for (const a of n.nurse?.serviceAreas ?? []) covering.set(a, (covering.get(a) ?? 0) + 1);

  const rows: ZoneRow[] = zones
    .filter((z): z is typeof z & { id: string } => Boolean(z.id))
    .map((z) => ({ ...z, nurses: covering.get(z.name) ?? 0 }));
  const served = servedZones(zones).length;
  const paused = zones.length - served;
  const uncovered = rows.filter((z) => z.status !== "paused" && z.nurses === 0).map((z) => z.name);

  return (
    <ConsoleShell
      session={session}
      roleLabel="Super admin"
      nav={nav}
      activeHref="/admin/zones"
      breadcrumb={["Platform", "Service zones"]}
      title="Service zones"
      meta={`${served} served${paused ? ` · ${paused} paused` : ""}`}
    >
      <p className="t-body text-[var(--color-ink-2)] max-w-[76ch] mb-6" style={{ textWrap: "pretty" }}>
        The pincodes a nurse can be sent to. A patient whose pincode is in a zone here can book; anyone else is told
        plainly that we do not serve them yet. The public Zones page, the FAQs and the booking screen all read this
        list. Pause a zone to stop offering it without losing the nurses who cover it.
      </p>

      {uncovered.length > 0 && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-caution)] bg-[var(--color-caution-soft)] px-4 py-3 mb-6">
          <span className="t-body text-[var(--color-ink-2)]">
            <span className="font-semibold text-[var(--color-ink)]">No nurse covers {uncovered.join(", ")}.</span>{" "}
            Patients there can still book, and are sent the nearest nurse. Tick the zone for a nurse in People.
          </span>
        </div>
      )}

      <ZoneEditor zones={rows} />
    </ConsoleShell>
  );
}
