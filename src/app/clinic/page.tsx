import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { clinicNav, startOfToday, endOfToday } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, Order, User } from "@/lib/models";
import { StatCard } from "@/components/ui/Card";
import { DataTable, THead, TH, TR, TD } from "@/components/ui/Table";
import { StatusPill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/States";
import { ButtonLink } from "@/components/ui/Button";
import { formatInr } from "@/lib/inventory/units";
import { formatDate, formatTime } from "@/lib/data/inventory";
import { Arrow } from "@/components/ui/Arrow";

export const metadata: Metadata = { title: "Clinic" };
export const dynamic = "force-dynamic";

export default async function ClinicPage() {
  const session = await requireRole("clinic", "superadmin");
  const nav = await clinicNav(session.sub);
  await connectDB();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [clinic, todayBookings, openOrders, monthCompleted, allBookings] = await Promise.all([
    User.findById(session.sub).lean<{
      name: string;
      clinic?: { city?: string; monthlyVolumeTarget?: number; partnerSince?: Date };
    } | null>(),
    Booking.find({
      clinicId: session.sub,
      scheduledAt: { $gte: startOfToday(), $lte: endOfToday() },
    })
      .sort({ scheduledAt: 1 })
      .lean<
        Array<{
          _id: unknown;
          bookingNo: string;
          patientId: unknown;
          dripName?: string;
          scheduledAt: Date;
          status: string;
          amount: number;
        }>
      >(),
    Order.find({ clinicId: session.sub, status: { $in: ["DRAFT", "CONFIRMED"] } })
      .sort({ createdAt: -1 })
      .lean<Array<{ _id: unknown; orderNo: string; status: string; amount: number; lines: unknown[] }>>(),
    Booking.find({
      clinicId: session.sub,
      status: "completed",
      completedAt: { $gte: monthStart },
    }).lean<Array<{ amount: number }>>(),
    Booking.countDocuments({ clinicId: session.sub }),
  ]);

  const patientNames = new Map(
    (
      await User.find({ _id: { $in: todayBookings.map((b) => b.patientId) } }).lean<
        Array<{ _id: unknown; name: string }>
      >()
    ).map((u) => [String(u._id), u.name])
  );

  const revenue = monthCompleted.reduce((s, b) => s + (b.amount ?? 0), 0);
  const target = clinic?.clinic?.monthlyVolumeTarget ?? 100;
  const pipeline = openOrders.reduce((s, o) => s + (o.amount ?? 0), 0);

  return (
    <ConsoleShell
      session={session}
      roleLabel="Partner clinic"
      nav={nav}
      activeHref="/clinic"
      breadcrumb={["Clinic", "Today"]}
      title={clinic?.name ?? "Today"}
      meta={clinic?.clinic?.city}
      actions={<ButtonLink href="/clinic/orders">Place an order</ButtonLink>}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard
          label="Sessions today"
          value={String(todayBookings.length)}
          pct={Math.min(100, todayBookings.length * 12)}
          note={`${monthCompleted.length} completed this month`}
        />
        <StatCard
          label="Open orders"
          value={String(openOrders.length)}
          pct={Math.min(100, openOrders.length * 20)}
          color="var(--color-caution)"
          note={pipeline ? `${formatInr(pipeline)} in the pipeline` : "Nothing outstanding"}
          href="/clinic/orders"
        />
        <StatCard label="Total bookings" value={String(allBookings)} pct={Math.min(100, allBookings * 4)} />
        <StatCard
          label="Revenue this month"
          value={formatInr(revenue)}
          pct={Math.min(100, (monthCompleted.length / target) * 100)}
          note={`${monthCompleted.length} of ${target} session target`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start">
        <section>
          <div className="flex items-baseline justify-between mb-3 gap-4">
            <h2 className="t-h3">Today&apos;s room</h2>
            <Link href="/clinic/bookings" className="t-body font-medium">
              All bookings&nbsp;<Arrow />
            </Link>
          </div>

          {todayBookings.length === 0 ? (
            <EmptyState
              kind="cleared"
              title="Nothing scheduled today"
              body="No sessions are booked into your rooms for today. Bookings from the patient app appear here as soon as a physician approves them."
            />
          ) : (
            <DataTable>
              <THead>
                <TR>
                  <TH width="90px">Time</TH>
                  <TH>Patient</TH>
                  <TH>Drip</TH>
                  <TH>Status</TH>
                  <TH numeric>Amount</TH>
                </TR>
              </THead>
              <tbody>
                {todayBookings.map((b) => (
                  <TR key={String(b._id)}>
                    <TD mono nowrap>{formatTime(b.scheduledAt)}</TD>
                    <TD nowrap>{patientNames.get(String(b.patientId)) ?? "—"}</TD>
                    <TD nowrap>{b.dripName ?? "—"}</TD>
                    <TD>
                      <StatusPill status={b.status} dot />
                    </TD>
                    <TD numeric>{formatInr(b.amount ?? 0)}</TD>
                  </TR>
                ))}
              </tbody>
            </DataTable>
          )}
        </section>

        <section>
          <div className="flex items-baseline justify-between mb-3 gap-4">
            <h2 className="t-h3">Your orders</h2>
            <Link href="/clinic/orders" className="t-body font-medium">
              All&nbsp;<Arrow />
            </Link>
          </div>

          {openOrders.length === 0 ? (
            <EmptyState
              kind="cleared"
              title="No open orders"
              body="Everything you have ordered has been dispatched."
              actionLabel="Place an order"
              actionHref="/clinic/orders"
            />
          ) : (
            <div className="flex flex-col gap-3">
              {openOrders.map((o) => (
                <div
                  key={String(o._id)}
                  className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex flex-col gap-1">
                    <span className="t-data text-[14.5px]">{o.orderNo}</span>
                    <span className="t-small text-[var(--color-ink-3)]">
                      {o.lines.length} line{o.lines.length === 1 ? "" : "s"} · {formatInr(o.amount ?? 0)}
                    </span>
                  </div>
                  <StatusPill status={o.status} dot />
                </div>
              ))}
            </div>
          )}

          {clinic?.clinic?.partnerSince && (
            <p className="t-small text-[var(--color-ink-3)] mt-5">
              Partner since {formatDate(clinic.clinic.partnerSince)}.
            </p>
          )}
        </section>
      </div>
    </ConsoleShell>
  );
}
