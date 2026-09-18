import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { MobileShell } from "@/components/layout/MobileShell";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, User } from "@/lib/models";
import { SignOutButton } from "@/components/layout/SignOutButton";
import { NURSE_TABS } from "../tabs";
import { nurseFeedback } from "@/lib/data/nurse-feedback";
import { formatDate } from "@/lib/data/inventory";

export const metadata: Metadata = { title: "Me" };
export const dynamic = "force-dynamic";

export default async function NurseProfilePage() {
  const session = await requireRole("nurse", "superadmin");
  await connectDB();

  const [me, completed, adverse, feedback] = await Promise.all([
    User.findById(session.sub).lean<{
      name: string;
      email?: string;
      phone?: string;
      nurse?: { licenseNo?: string; serviceAreas?: string[] };
      createdAt: Date;
    } | null>(),
    Booking.countDocuments({ nurseId: session.sub, status: "completed" }),
    Booking.countDocuments({ nurseId: session.sub, "adverseEvents.0": { $exists: true } }),
    nurseFeedback(session.sub),
  ]);

  return (
    <MobileShell title={me?.name ?? "Me"} subtitle="Your record" tabs={NURSE_TABS} activeHref="/nurse/me">
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-4">
        <span className="t-micro">Registration</span>
        <div className="flex flex-col gap-2 mt-3">
          {[
            ["Council number", me?.nurse?.licenseNo ?? "—"],
            ["Email", me?.email ?? "—"],
            ["Phone", me?.phone ?? "—"],
            ["Zones", me?.nurse?.serviceAreas?.join(", ") ?? "—"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 items-baseline">
              <span className="t-body text-[var(--color-ink-2)]">{k}</span>
              <span className="t-data text-[14.5px] text-right">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-6">
        <span className="t-micro">Your record</span>
        <div className="flex gap-8 mt-3 flex-wrap">
          <div className="flex flex-col">
            <span className="t-data text-[26px] leading-[1.15]">{completed}</span>
            <span className="t-small text-[var(--color-ink-3)]">sessions completed</span>
          </div>
          <div className="flex flex-col">
            <span className="t-data text-[26px] leading-[1.15]">{adverse}</span>
            <span className="t-small text-[var(--color-ink-3)]">adverse events filed</span>
          </div>
          {/* Never a bare average: 4.5 from two sessions and 4.5 from two
              hundred are not the same claim about somebody's work. */}
          <div className="flex flex-col">
            <span className="t-data text-[26px] leading-[1.15]">
              {feedback.average !== null ? `${feedback.average}/5` : "—"}
            </span>
            <span className="t-small text-[var(--color-ink-3)]">
              {feedback.count === 0
                ? "not yet rated"
                : `from ${feedback.count} ${feedback.count === 1 ? "rating" : "ratings"}`}
            </span>
          </div>
        </div>
        <p className="t-small text-[var(--color-ink-2)] mt-4">
          Filing an adverse event is never held against you. Not filing one is.
        </p>
      </div>

      {/* ---------------- what patients actually said ---------------- */}
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-6">
        <span className="t-micro">What patients said</span>
        {feedback.recent.length === 0 ? (
          <p className="t-body text-[var(--color-ink-2)] mt-3">
            Nobody has rated a session yet. Patients are asked once a session is finished, and it is optional — a quiet
            record is not a bad one.
          </p>
        ) : (
          <div className="flex flex-col gap-4 mt-4">
            {feedback.recent.map((f) => (
              <div key={f.bookingId} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="t-data text-[14.5px]">{f.rating}/5</span>
                  <span className="t-small text-[var(--color-ink-3)]">
                    {f.bookingNo}
                    {f.givenAt ? ` · ${formatDate(f.givenAt)}` : ""}
                  </span>
                </div>
                {f.comment ? (
                  <p className="t-body text-[var(--color-ink-2)]">{f.comment}</p>
                ) : (
                  <span className="t-small text-[var(--color-ink-3)]">No comment left.</span>
                )}
              </div>
            ))}
          </div>
        )}
        {feedback.poor > 0 && (
          <p className="t-small text-[var(--color-ink-2)] mt-4">
            {feedback.poor === 1 ? "One rating was" : `${feedback.poor} ratings were`} 2 or less. A physician was told
            at the time, so this is not news being broken to you here.
          </p>
        )}
      </div>

      <div className="mt-6 pt-5 border-t border-[var(--color-line)]">
        <SignOutButton />
      </div>
    </MobileShell>
  );
}
