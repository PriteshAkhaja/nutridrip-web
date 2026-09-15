import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { MobileShell } from "@/components/layout/MobileShell";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, User } from "@/lib/models";
import { StatusPill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/States";
import { formatDate, formatTime } from "@/lib/data/inventory";
import { NURSE_TABS } from "../tabs";

export const metadata: Metadata = { title: "Schedule" };
export const dynamic = "force-dynamic";

export default async function NurseSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await requireRole("nurse", "superadmin");
  const { view = "upcoming" } = await searchParams;
  const past = view === "past";
  await connectDB();

  const from = new Date();
  from.setHours(0, 0, 0, 0);

  const bookings = await Booking.find({
    nurseId: session.sub,
    scheduledAt: past ? { $lt: from } : { $gte: from },
    ...(past ? {} : { status: { $ne: "cancelled" } }),
  })
    .sort({ scheduledAt: past ? -1 : 1 })
    .limit(60)
    .lean<
      Array<{
        _id: unknown;
        bookingNo: string;
        patientId: unknown;
        dripName?: string;
        scheduledAt: Date;
        status: string;
        address?: string;
      }>
    >();

  const patients = await User.find({ _id: { $in: bookings.map((b) => b.patientId) } }).lean<
    Array<{ _id: unknown; name: string }>
  >();
  const nameById = new Map(patients.map((p) => [String(p._id), p.name]));

  const byDay = new Map<string, typeof bookings>();
  for (const b of bookings) {
    const key = b.scheduledAt.toDateString();
    byDay.set(key, [...(byDay.get(key) ?? []), b]);
  }

  return (
    <MobileShell
      title="Schedule"
      subtitle={`${bookings.length} session${bookings.length === 1 ? "" : "s"} ${past ? "completed" : "ahead"}`}
      tabs={NURSE_TABS}
      activeHref="/nurse/schedule"
    >
      <div className="flex gap-1 p-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] border border-[var(--color-line)] mb-5 w-fit">
        {[
          ["upcoming", "Upcoming"],
          ["past", "History"],
        ].map(([key, label]) => (
          <Link
            key={key}
            href={`/nurse/schedule?view=${key}`}
            className={`px-4 min-h-[36px] inline-flex items-center rounded-[6px] text-[13px] font-semibold no-underline hover:no-underline ${
              view === key ? "bg-[var(--color-surface)] text-[var(--color-ink)]" : "text-[var(--color-ink-2)]"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          kind="cleared"
          title={past ? "No past sessions" : "Nothing scheduled"}
          body={
            past
              ? "Sessions you have run appear here with their reports."
              : "Sessions are assigned to you by dispatch once a physician approves the protocol."
          }
        />
      ) : (
        <div className="flex flex-col gap-6">
          {[...byDay].map(([day, items]) => (
            <section key={day}>
              <span className="t-micro block mb-3">
                {formatDate(day)} · {items.length} session{items.length === 1 ? "" : "s"}
              </span>
              <div className="flex flex-col gap-2">
                {items.map((b) => (
                  <Link
                    key={String(b._id)}
                    href={b.status === "completed" ? `/nurse/session/${String(b._id)}/report` : `/nurse/session/${String(b._id)}`}
                    className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4 flex items-center justify-between gap-3 no-underline hover:no-underline hover:border-[var(--color-primary-line)] transition-colors duration-150"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="t-data text-[14.5px]">{formatTime(b.scheduledAt)}</span>
                      <span className="t-body font-medium truncate">
                        {nameById.get(String(b.patientId)) ?? "—"}
                      </span>
                      <span className="t-small text-[var(--color-ink-3)] truncate">
                        {b.dripName} · {b.address ?? "—"}
                      </span>
                    </div>
                    <StatusPill status={b.status} dot />
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </MobileShell>
  );
}
