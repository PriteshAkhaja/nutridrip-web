import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { doctorNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { connectDB } from "@/lib/db/mongoose";
import { Drip, TreatmentPlan, User } from "@/lib/models";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/States";
import { FillSegments } from "@/components/ui/Fill";
import { formatDate } from "@/lib/data/inventory";
import { PlanBuilder } from "./PlanBuilder";
import { ShareToggle } from "./ShareToggle";

export const metadata: Metadata = { title: "Treatment plans" };
export const dynamic = "force-dynamic";

export default async function PlansPage() {
  const session = await requireRole("doctor", "superadmin");
  const nav = await doctorNav(session.sub);
  await connectDB();

  const [plans, patients, nurses, drips] = await Promise.all([
    TreatmentPlan.find(session.role === "doctor" ? { doctorId: session.sub } : {})
      .sort({ createdAt: -1 })
      .lean<
        Array<{
          _id: unknown;
          patientId: unknown;
          nurseId?: unknown;
          diagnosis?: string;
          startDate?: Date;
          totalWeeks: number;
          sharedWithNurse: boolean;
          status: string;
          weeks: Array<{ weekNum: number; sessions: Array<{ date: Date; dripName: string }> }>;
          createdAt: Date;
        }>
      >(),
    User.find({ role: "patient", status: "active" })
      .sort({ name: 1 })
      .lean<Array<{ _id: unknown; name: string; patient?: { city?: string } }>>(),
    User.find({ role: "nurse", status: "active" })
      .sort({ name: 1 })
      .lean<Array<{ _id: unknown; name: string }>>(),
    Drip.find({ isActive: true })
      .sort({ name: 1 })
      .lean<Array<{ _id: unknown; name: string; ingredients?: Array<{ name?: string }> }>>(),
  ]);

  const nameById = new Map(
    [...patients, ...nurses].map((u) => [String(u._id), u.name])
  );

  return (
    <ConsoleShell
      session={session}
      roleLabel="Physician"
      nav={nav}
      activeHref="/doctor/plans"
      breadcrumb={["Clinical", "Treatment plans"]}
      title="Treatment plans"
      meta={`${plans.length} plan${plans.length === 1 ? "" : "s"}`}
    >
      <p className="t-body text-[var(--color-ink-2)] max-w-[76ch] mb-6" style={{ textWrap: "pretty" }}>
        A plan is a course, not a single session — several weeks of drips with their doses and routes written out.
        It stays a draft until you share it, and sharing is what puts it on a nurse&apos;s schedule. Every plan prints
        as a prescription slip carrying your council registration.
      </p>

      <div className="mb-6">
        <PlanBuilder
          patients={patients.map((p) => ({
            id: String(p._id),
            name: p.name,
            city: p.patient?.city ?? "",
          }))}
          nurses={nurses.map((n) => ({ id: String(n._id), name: n.name }))}
          drips={drips.map((d) => ({
            id: String(d._id),
            name: d.name,
            keywords: (d.ingredients ?? []).map((i) => i.name),
          }))}
        />
      </div>

      {plans.length === 0 ? (
        <EmptyState
          kind="first-run"
          title="No plans yet"
          body="Write one when a patient needs a course rather than a single session — a four-week iron protocol, or six weeks of glutathione."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {plans.map((p) => {
            const sessions = p.weeks.flatMap((w) => w.sessions);
            const past = sessions.filter((s) => new Date(s.date) < new Date()).length;

            return (
              <Card key={String(p._id)} padding="p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <Link
                        href={`/doctor/patients/${String(p.patientId)}`}
                        className="t-h3 no-underline hover:no-underline"
                      >
                        {nameById.get(String(p.patientId)) ?? "Unknown patient"}
                      </Link>
                      <StatusPill status={p.status} dot />
                    </div>
                    {p.diagnosis && (
                      <p className="t-body text-[var(--color-ink-2)] mt-1 max-w-[46ch]">{p.diagnosis}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end flex-none">
                    <span className="t-data text-[18px]">{p.totalWeeks}</span>
                    <span className="t-small text-[var(--color-ink-3)]">weeks</span>
                  </div>
                </div>

                <div className="py-4 border-y border-[var(--color-line)]">
                  <FillSegments name="Sessions run" done={past} total={sessions.length} />
                </div>

                <div className="flex flex-col gap-2 mt-4">
                  {[
                    ["Starts", p.startDate ? formatDate(p.startDate) : "—"],
                    ["Nurse", p.nurseId ? (nameById.get(String(p.nurseId)) ?? "—") : "Not assigned"],
                    ["Written", formatDate(p.createdAt)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 items-baseline">
                      <span className="t-body text-[var(--color-ink-2)]">{k}</span>
                      <span className="t-data text-[14.5px]">{v}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-[var(--color-line)] flex items-center justify-between gap-3 flex-wrap">
                  <Link href={`/doctor/plans/${String(p._id)}/print`} className="t-small font-semibold">
                    Print Rx →
                  </Link>
                </div>
                <div className="mt-4 pt-4 border-t border-[var(--color-line)]">
                  <ShareToggle
                    planId={String(p._id)}
                    shared={p.sharedWithNurse}
                    nurseId={p.nurseId ? String(p.nurseId) : null}
                    nurses={nurses.map((n) => ({ id: String(n._id), name: n.name }))}
                  />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </ConsoleShell>
  );
}
