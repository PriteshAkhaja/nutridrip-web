import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { adminNav, startOfToday, endOfToday } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { StatCard } from "@/components/ui/Card";
import { DataTable, THead, TH, TR, TD } from "@/components/ui/Table";
import { StatusPill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/States";
import { ButtonLink } from "@/components/ui/Button";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, HealthQuiz, Order, User } from "@/lib/models";
import { getAlerts } from "@/lib/inventory/alerts";
import { formatInr } from "@/lib/inventory/units";
import { formatDate, formatTime } from "@/lib/data/inventory";
import { Arrow } from "@/components/ui/Arrow";

export const metadata: Metadata = { title: "Overview" };
export const dynamic = "force-dynamic";

const MONTHLY_REVENUE_TARGET = 2_600_000;

export default async function AdminOverviewPage() {
  const session = await requireRole("superadmin", "admin");
  const nav = await adminNav();
  await connectDB();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [patients, doctors, clinics, pendingQuizzes, alerts, todayBookings, completedThisMonth, recentBookings] =
    await Promise.all([
      User.countDocuments({ role: "patient", status: "active" }),
      User.countDocuments({ role: "doctor", status: "active" }),
      User.countDocuments({ role: "clinic", status: "active" }),
      HealthQuiz.countDocuments({ reviewStatus: "pending" }),
      getAlerts(30),
      Booking.countDocuments({ scheduledAt: { $gte: startOfToday(), $lt: endOfToday() } }),
      Booking.find({ status: "completed", completedAt: { $gte: monthStart } }).lean<
        Array<{ amount: number }>
      >(),
      Booking.find({})
        .sort({ scheduledAt: -1 })
        .limit(8)
        .lean<
          Array<{
            _id: unknown;
            bookingNo: string;
            dripName?: string;
            scheduledAt: Date;
            status: string;
            amount: number;
            patientId: unknown;
          }>
        >(),
    ]);

  const revenue = completedThisMonth.reduce((s, b) => s + (b.amount ?? 0), 0);
  const patientNames = new Map(
    (
      await User.find({ _id: { $in: recentBookings.map((b) => b.patientId) } }).lean<
        Array<{ _id: unknown; name: string }>
      >()
    ).map((u) => [String(u._id), u.name])
  );

  const openOrders = await Order.find({ status: { $in: ["DRAFT", "CONFIRMED"] } })
    .sort({ createdAt: -1 })
    .limit(5)
    .lean<Array<{ _id: unknown; orderNo: string; status: string; amount: number; lines: unknown[] }>>();

  return (
    <ConsoleShell
      session={session}
      roleLabel={session.role === "superadmin" ? "Super admin" : "Admin"}
      nav={nav}
      activeHref="/admin"
      breadcrumb={["Platform", "Overview"]}
      title="Overview"
      meta={`Updated ${formatTime(new Date())}`}
      actions={<ButtonLink href="/admin/inventory/availability">Check availability</ButtonLink>}
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 mb-6">
        <StatCard
          label="Pending approvals"
          value={String(pendingQuizzes)}
          pct={pendingQuizzes ? Math.min(100, pendingQuizzes * 12) : 0}
          color="var(--color-caution)"
          note={pendingQuizzes ? "Quizzes waiting on a physician" : "Queue is clear"}
          href="/admin/approvals"
        />
        <StatCard
          label="Sessions today"
          value={String(todayBookings)}
          pct={Math.min(100, todayBookings * 8)}
          note={`${clinics} partner clinic${clinics === 1 ? "" : "s"} · ${doctors} physician${doctors === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Batches expiring ≤30d"
          value={String(alerts.counts.expiringSoon + alerts.counts.expired)}
          pct={Math.min(100, (alerts.counts.expiringSoon + alerts.counts.expired) * 14)}
          color="var(--color-critical)"
          note={`${formatInr(alerts.valueAtRiskInr)} at risk`}
          href="/admin/inventory/alerts"
        />
        <StatCard
          label="Revenue this month"
          value={formatInr(revenue)}
          pct={Math.round((revenue / MONTHLY_REVENUE_TARGET) * 100)}
          note={`${Math.round((revenue / MONTHLY_REVENUE_TARGET) * 100)}% of ${formatInr(MONTHLY_REVENUE_TARGET)} target`}
        />
      </div>

      {/* Side by side only from 1760px. Below that the table takes the full width and this panel sits under it: with names and dates held on one line, the table does not fit beside the panel on a laptop or a 1536-1680px monitor (measured; the orders list beside its 400px composer needs about 1740px). */}
      <div className="grid grid-cols-1 gap-6 min-[1760px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start">
        <section>
          <div className="flex items-baseline justify-between mb-3 gap-4">
            <h2 className="t-h3">Recent sessions</h2>
            <span className="t-data text-[13px] text-[var(--color-ink-3)]">{patients} patients</span>
          </div>

          {recentBookings.length === 0 ? (
            <EmptyState
              kind="first-run"
              title="No sessions yet"
              body="Once a physician approves a protocol, sessions appear here with their full timeline."
              actionLabel="Check availability"
              actionHref="/admin/inventory/availability"
            />
          ) : (
            <DataTable>
              <THead>
                <TR>
                  <TH width="120px">Booking</TH>
                  <TH>Patient</TH>
                  <TH>Drip</TH>
                  <TH>Scheduled</TH>
                  <TH>Status</TH>
                  <TH numeric>Amount</TH>
                </TR>
              </THead>
              <tbody>
                {recentBookings.map((b) => (
                  <TR key={String(b._id)}>
                    <TD mono nowrap>{b.bookingNo}</TD>
                    <TD nowrap>{patientNames.get(String(b.patientId)) ?? "—"}</TD>
                    <TD nowrap>{b.dripName ?? "—"}</TD>
                    <TD mono nowrap>
                      {formatDate(b.scheduledAt)} · {formatTime(b.scheduledAt)}
                    </TD>
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
            <h2 className="t-h3">Open preparation orders</h2>
            <Link href="/admin/inventory/orders" className="t-body font-medium">
              All orders&nbsp;<Arrow />
            </Link>
          </div>

          {openOrders.length === 0 ? (
            <EmptyState
              kind="cleared"
              title="Nothing waiting to be prepared"
              body="Every confirmed order has been dispatched. New orders from partner clinics appear here."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {openOrders.map((o) => (
                <Link
                  key={String(o._id)}
                  href={`/admin/inventory/orders/${String(o._id)}`}
                  className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4 no-underline hover:no-underline hover:border-[var(--color-primary-line)] transition-colors duration-150 flex items-center justify-between gap-4"
                >
                  <div className="flex flex-col gap-1 min-w-0">
                    <span className="t-data text-[14.5px]">{o.orderNo}</span>
                    <span className="t-small text-[var(--color-ink-3)]">
                      {o.lines.length} line{o.lines.length === 1 ? "" : "s"} · {formatInr(o.amount ?? 0)}
                    </span>
                  </div>
                  <StatusPill status={o.status} dot />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </ConsoleShell>
  );
}
