import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { clinicNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { connectDB } from "@/lib/db/mongoose";
import { Types } from "mongoose";
import { Booking, User } from "@/lib/models";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/Card";
import { formatDate } from "@/lib/data/inventory";
import { formatInr } from "@/lib/inventory/units";

export const metadata: Metadata = { title: "Clinic profile" };
export const dynamic = "force-dynamic";

export default async function ClinicProfilePage() {
  const session = await requireRole("clinic", "superadmin");
  const nav = await clinicNav(session.sub);
  await connectDB();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [clinic, completed] = await Promise.all([
    User.findById(session.sub).lean<{
      name: string;
      email?: string;
      phone?: string;
      status: string;
      clinic?: {
        address?: string;
        city?: string;
        pincode?: string;
        partnerSince?: Date;
        monthlyVolumeTarget?: number;
        gstin?: string;
      };
    } | null>(),
    // Counted and summed by the database. An aggregation does not cast ids the
    // way find() does, so the clinic's id is made an ObjectId here.
    Booking.aggregate<{ count: number; revenue: number }>([
        { $match: { clinicId: new Types.ObjectId(session.sub), status: "completed", completedAt: { $gte: monthStart } } },
        { $group: { _id: null, count: { $sum: 1 }, revenue: { $sum: { $ifNull: ["$amount", 0] } } } },
      ]),
  ]);

  const c = clinic?.clinic ?? {};
  const target = c.monthlyVolumeTarget ?? 100;
  const completedCount = completed[0]?.count ?? 0;
  const revenue = completed[0]?.revenue ?? 0;

  return (
    <ConsoleShell
      session={session}
      roleLabel="Partner clinic"
      nav={nav}
      activeHref="/clinic/profile"
      breadcrumb={["Clinic", "Profile"]}
      title={clinic?.name ?? "Profile"}
      meta={clinic?.status === "active" ? "Active partner" : clinic?.status}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 mb-6">
        <StatCard
          label="Sessions this month"
          value={String(completedCount)}
          pct={Math.min(100, (completedCount / target) * 100)}
          note={`${Math.round((completedCount / target) * 100)}% of your ${target} target`}
        />
        <StatCard label="Revenue this month" value={formatInr(revenue)} pct={Math.min(100, (revenue / 500000) * 100)} />
        <StatCard
          label="Partner since"
          value={c.partnerSince ? formatDate(c.partnerSince) : "—"}
          note="Terms renew annually"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card padding="p-6">
          <span className="t-micro">Registered details</span>
          <div className="flex flex-col gap-2 mt-4">
            {[
              ["Clinic name", clinic?.name ?? "—"],
              ["Address", c.address ?? "—"],
              ["City", c.city ?? "—"],
              ["Pincode", c.pincode ?? "—"],
              ["GSTIN", c.gstin ?? "—"],
              ["Email", clinic?.email ?? "—"],
              ["Phone", clinic?.phone ?? "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 items-baseline">
                <span className="t-body text-[var(--color-ink-2)] flex-none">{k}</span>
                <span className="t-body font-medium text-right">{v}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card padding="p-6" tone="muted">
          <span className="t-micro">Changing these</span>
          <p className="t-body-lg mt-3" style={{ textWrap: "pretty" }}>
            Registered details are tied to your partnership agreement, so they are changed by the platform team rather
            than edited here. Everything operational — orders, bookings, rooms — is yours to run.
          </p>
          <p className="t-body text-[var(--color-ink-2)] mt-4">
            Contact <a href="mailto:partners@nutridrip.com">partners@nutridrip.com</a> to amend anything on the left.
          </p>
        </Card>
      </div>
    </ConsoleShell>
  );
}
