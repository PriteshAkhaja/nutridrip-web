import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { doctorNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { connectDB } from "@/lib/db/mongoose";
import { Drip, ProductMaster, TreatmentPlan, User } from "@/lib/models";
import { Card } from "@/components/ui/Card";
import { StatusPill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/States";
import { FillSegments } from "@/components/ui/Fill";
import { formatDate } from "@/lib/data/inventory";
import { ageFrom } from "@/lib/data/clinical";
import { toDay, type PlanComponentInput } from "@/lib/clinical/plan-input";
import { PlanBuilder, type PlanDraft } from "./PlanBuilder";
import { ShareToggle } from "./ShareToggle";
import { PlanActions } from "./PlanActions";
import { Arrow } from "@/components/ui/Arrow";

export const metadata: Metadata = { title: "Treatment plans" };
export const dynamic = "force-dynamic";

type PlanComponentDoc = PlanComponentInput & { masterId?: unknown };
type PlanSessionDoc = {
  date: Date;
  dripId?: unknown;
  dripName: string;
  components?: PlanComponentDoc[];
  sessionNotes?: string;
};
type PlanDoc = {
  _id: unknown;
  patientId: unknown;
  nurseId?: unknown;
  diagnosis?: string;
  patientAge?: string;
  patientWeightKg?: number;
  patientHeightCm?: number;
  bloodGroup?: string;
  startDate?: Date;
  totalWeeks: number;
  sharedWithNurse: boolean;
  status: string;
  weeks: Array<{ weekNum: number; sessions: PlanSessionDoc[] }>;
  createdAt: Date;
};

/**
 * The stored plan, in the shape the builder edits.
 *
 * Plans written before components recorded a product carry only a name. Where
 * that name is exactly a product's, the link is restored — that is a lookup,
 * not a guess, and without it every one of those lines would have to be picked
 * again by hand before the plan could be saved at all. A name that matches
 * nothing stays unlinked and is shown as such.
 */
function toDraft(p: PlanDoc, masterByName: Map<string, string>): PlanDraft {
  return {
    id: String(p._id),
    patientId: String(p.patientId),
    diagnosis: p.diagnosis ?? "",
    startDate: toDay(p.startDate ?? p.createdAt),
    nurseId: p.nurseId ? String(p.nurseId) : "",
    sharedWithNurse: p.sharedWithNurse,
    patientAge: p.patientAge ?? "",
    patientWeightKg: p.patientWeightKg ? String(p.patientWeightKg) : "",
    patientHeightCm: p.patientHeightCm ? String(p.patientHeightCm) : "",
    bloodGroup: p.bloodGroup ?? "",
    weeks: p.weeks.map((w) => ({
      weekNum: w.weekNum,
      sessions: w.sessions.map((s) => ({
        date: toDay(s.date),
        dripId: s.dripId ? String(s.dripId) : "",
        dripName: s.dripName,
        sessionNotes: s.sessionNotes ?? "",
        components: (s.components ?? []).map((c) => ({
          masterId: c.masterId
            ? String(c.masterId)
            : masterByName.get(c.name.trim().toLowerCase()),
          name: c.name,
          dose: c.dose,
          unit: c.unit,
          route: c.route,
          carrier: c.carrier,
        })),
      })),
    })),
  };
}

export default async function PlansPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; show?: string }>;
}) {
  const session = await requireRole("doctor", "superadmin");
  const { edit, show } = await searchParams;
  const showArchived = show === "archived";
  const nav = await doctorNav(session.sub);
  await connectDB();

  const [plans, patients, nurses, drips, masters] = await Promise.all([
    TreatmentPlan.find({
      ...(session.role === "doctor" ? { doctorId: session.sub } : {}),
      // Archiving is meant to clear the list. Leaving them in would make the
      // action do nothing on the very screen it exists for.
      ...(showArchived ? { status: "archived" } : { status: { $ne: "archived" } }),
    })
      .sort({ createdAt: -1 })
      .lean<PlanDoc[]>(),
    User.find({ role: "patient", status: "active" })
      .sort({ name: 1 })
      .lean<
        Array<{
          _id: unknown;
          name: string;
          patient?: {
            city?: string;
            dob?: Date;
            weightKg?: number;
            heightCm?: number;
            bloodGroup?: string;
          };
        }>
      >(),
    User.find({ role: "nurse", status: "active" })
      .sort({ name: 1 })
      .lean<Array<{ _id: unknown; name: string }>>(),
    // The recipe comes down with the drip so choosing one fills the session's
    // components in on the spot, with no round trip and nothing to get stale.
    Drip.find({ isActive: true })
      .sort({ name: 1 })
      .lean<
        Array<{
          _id: unknown;
          name: string;
          category?: string;
          ingredients?: Array<{
            masterId?: unknown;
            name?: string;
            dose: number;
            unit: string;
            role?: string;
          }>;
        }>
      >(),
    ProductMaster.find({ isActive: true })
      .sort({ name: 1 })
      .lean<Array<{ _id: unknown; name: string; canonicalUnit: string }>>(),
  ]);

  const nameById = new Map([...patients, ...nurses].map((u) => [String(u._id), u.name]));
  const masterByName = new Map(masters.map((m) => [m.name.trim().toLowerCase(), String(m._id)]));
  const editing = edit ? plans.find((p) => String(p._id) === edit) : undefined;

  const builderProps = {
    patients: patients.map((p) => ({
      id: String(p._id),
      name: p.name,
      city: p.patient?.city ?? "",
      age: p.patient?.dob ? ageFrom(p.patient.dob) : undefined,
      weightKg: p.patient?.weightKg,
      heightCm: p.patient?.heightCm,
      bloodGroup: p.patient?.bloodGroup,
    })),
    nurses: nurses.map((n) => ({ id: String(n._id), name: n.name })),
    drips: drips.map((d) => ({
      id: String(d._id),
      name: d.name,
      category: d.category,
      keywords: (d.ingredients ?? []).map((i) => i.name),
      // Rebuilt field by field rather than passed through. A lean() document
      // still carries ObjectIds, and an ObjectId cannot cross into a client
      // component — React has to be able to serialise every prop, and this one
      // would arrive as a Buffer if it arrived at all.
      ingredients: (d.ingredients ?? []).map((i) => ({
        masterId: i.masterId ? String(i.masterId) : undefined,
        name: i.name,
        dose: i.dose,
        unit: i.unit,
        role: i.role,
      })),
    })),
    masters: masters.map((m) => ({
      id: String(m._id),
      name: m.name,
      unit: m.canonicalUnit,
    })),
  };

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
        Each session can carry a different protocol, its own components and a note for the nurse. It stays a draft
        until you share it, and sharing is what puts it on a nurse&apos;s schedule. Every plan prints as a
        prescription slip carrying your council registration.
      </p>

      {/* Archived plans have to be reachable, or "archive" is indistinguishable
          from "delete" — and the whole reason a shared plan is archived rather
          than deleted is that the record stands. */}
      <div className="flex gap-1 p-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] border border-[var(--color-line)] mb-5 w-fit">
        {[
          ["", "Open"],
          ["archived", "Archived"],
        ].map(([key, label]) => (
          <Link
            key={label}
            href={key ? "/doctor/plans?show=archived" : "/doctor/plans"}
            className={`px-4 min-h-[36px] inline-flex items-center rounded-[6px] text-[13px] font-semibold no-underline hover:no-underline ${
              (key === "archived") === showArchived
                ? "bg-[var(--color-surface)] text-[var(--color-ink)]"
                : "text-[var(--color-ink-2)]"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      <div className="mb-6">
        {showArchived ? null : editing ? (
          <PlanBuilder
            key={String(editing._id)}
            {...builderProps}
            initial={toDraft(editing, masterByName)}
          />
        ) : (
          <PlanBuilder {...builderProps} />
        )}
      </div>

      {plans.length === 0 ? (
        <EmptyState
          kind="first-run"
          title={showArchived ? "Nothing archived" : "No plans yet"}
          body={
            showArchived
              ? "Plans you close appear here. They stay readable — archiving takes a course off everyone's screen without pretending it never happened."
              : "Write one when a patient needs a course rather than a single session — a four-week iron protocol, or six weeks of glutathione."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {plans.map((p) => {
            const sessions = p.weeks.flatMap((w) => w.sessions);
            const past = sessions.filter((s) => new Date(s.date) < new Date()).length;
            const protocols = [...new Set(sessions.map((s) => s.dripName).filter(Boolean))];
            const noted = sessions.filter((s) => s.sessionNotes).length;

            return (
              <Card key={String(p._id)} padding="p-6" className="h-full flex flex-col">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <Link
                        href={`/doctor/patients/${String(p.patientId)}`}
                        className="t-h3 no-underline hover:no-underline"
                      >
                        {nameById.get(String(p.patientId)) ?? "Unknown patient"}
                      </Link>
                      {/* An active plan is a course still being given, so it
                          pulses. Set here rather than in the shared live list:
                          "active" on an account means only that it is enabled,
                          and those rows must stay still. */}
                      <StatusPill status={p.status} dot pulse={p.status === "active"} />
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

                {/* mb-4 carries the fixed gap above the footer rule. It cannot
                    live on the footer as mt-4, because that footer uses mt-auto
                    to sink to the card's base and auto absorbs the whole
                    margin — leaving 0 on any card tall enough to have no slack. */}
                <div className="flex flex-col gap-2 mt-4 mb-4">
                  {[
                    ["Starts", p.startDate ? formatDate(p.startDate) : "—"],
                    ["Protocols", protocols.length ? protocols.join(" · ") : "—"],
                    ["Session notes", noted ? `${noted} of ${sessions.length}` : "None"],
                    ["Nurse", p.nurseId ? (nameById.get(String(p.nurseId)) ?? "—") : "Not assigned"],
                    ["Written", formatDate(p.createdAt)],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-4 items-baseline">
                      <span className="t-body text-[var(--color-ink-2)]">{k}</span>
                      <span className="t-data text-[14.5px] text-right">{v}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-auto pt-4 border-t border-[var(--color-line)] flex items-center gap-5 flex-wrap">
                  <Link href={`/doctor/plans?edit=${String(p._id)}`} className="t-small font-semibold">
                    Edit the plan&nbsp;<Arrow />
                  </Link>
                  <Link href={`/doctor/plans/${String(p._id)}/print`} className="t-small font-semibold">
                    Print Rx&nbsp;<Arrow />
                  </Link>
                </div>
                <div className="mt-4 pt-4 border-t border-[var(--color-line)] flex flex-col gap-4">
                  <PlanActions
                    planId={String(p._id)}
                    status={p.status}
                    shared={p.sharedWithNurse}
                    patientName={nameById.get(String(p.patientId)) ?? "this patient"}
                  />
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
