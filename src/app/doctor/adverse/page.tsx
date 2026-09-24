import Link from "next/link";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { doctorNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, User } from "@/lib/models";
import { Pill } from "@/components/ui/Pill";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/States";
import { VITAL_RANGES, type VitalKey } from "@/lib/clinical/checklist";
import { describeWait } from "@/lib/clinical/prescription";
import { HeaderCounts, plural } from "@/components/layout/HeaderCounts";
import { formatDate, formatTime } from "@/lib/data/inventory";
import { VitalsDecision } from "./VitalsDecision";
import { RxOverrideDecision } from "./RxOverrideDecision";
import { AdverseDecision } from "./AdverseDecision";
import { PagedResults, PagedView, Pagination } from "@/components/ui/Paged";
import { parsePaging } from "@/lib/pagination";
import { paginate } from "@/lib/pagination-db";
import { VitalsCorrected } from "@/components/ui/VitalsCorrected";
import type { VitalsCorrection } from "@/lib/clinical/checklist";

export const metadata: Metadata = { title: "Escalations" };
export const dynamic = "force-dynamic";

const SEVERITY_TONE = { mild: "caution", moderate: "caution", severe: "critical" } as const;

type Vitals = {
  takenAt: Date;
  label?: string;
  systolic?: number;
  diastolic?: number;
  heartRate?: number;
  spo2?: number;
  temperatureF?: number;
  outOfRange?: string[];
  corrections?: VitalsCorrection[];
};

/** "SpO₂ 91 %, below 95–100" — the reading and the band it broke, in words. */
function describe(v: Vitals): string {
  return (v.outOfRange ?? [])
    .map((k) => {
      const key = k as VitalKey;
      const range = VITAL_RANGES[key];
      const value = v[key];
      if (!range || value === undefined) return k;
      const side = value < range.min ? "below" : "above";
      return `${range.label} ${value} ${range.unit}, ${side} ${range.min}–${range.max}`;
    })
    .join(" · ");
}

const WHERE: Record<string, string> = {
  home: "at home",
  office: "at their office",
  clinic: "at a partner clinic",
  hotel: "at a hotel",
};

type EventBooking = {
          _id: unknown;
          bookingNo: string;
          patientId: unknown;
          nurseId?: unknown;
          dripName?: string;
          scheduledAt: Date;
          adverseEvents: Array<{
            _id: unknown;
            at: Date;
            symptoms: string[];
            severity?: string;
            actionsTaken?: string[];
            infusionStopped?: boolean;
            notes?: string;
            determination?: string;
            acknowledgedAt?: Date;
          }>;
        };

export default async function EscalationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const { page, pageSize } = await searchParams;
  const paging = parsePaging({ page, pageSize });
  const session = await requireRole("doctor", "superadmin");
  const nav = await doctorNav(session.sub);
  await connectDB();

  const [blocked, rxRequests, openEventBookings, history] = await Promise.all([
    // Sessions a nurse cannot start until a physician clears the baseline.
    Booking.find({
      "vitals.outOfRange.0": { $exists: true },
      vitalsClearedAt: null,
      status: { $in: ["nurse_assigned", "en_route", "in_progress"] },
    })
      .sort({ scheduledAt: 1 })
      .lean<
        Array<{
          _id: unknown;
          bookingNo: string;
          patientId: unknown;
          nurseId?: unknown;
          dripName?: string;
          scheduledAt: Date;
          vitals: Vitals[];
        }>
      >(),
    // A nurse with a patient who cannot give a code, waiting on a physician.
    Booking.find({
      "rxOverride.requestedAt": { $exists: true },
      rxUnlockedAt: null,
      "rxOverride.deniedAt": null,
      status: { $in: ["approved", "nurse_assigned", "en_route", "in_progress"] },
    })
      .sort({ "rxOverride.requestedAt": 1 })
      .lean<
        Array<{
          _id: unknown;
          bookingNo: string;
          patientId: unknown;
          nurseId?: unknown;
          dripName?: string;
          scheduledAt: Date;
          status: string;
          location?: string;
          address?: string;
          pincode?: string;
          rxOverride?: { requestedAt?: Date; lastAskedAt?: Date; reason?: string };
        }>
      >(),
    // Every booking with a report STILL AWAITING a determination, in full and
    // never paged. This used to be one query cut at 100, so an open report on
    // an older session could drop off the list and out of the "awaiting your
    // determination" count. An open safety event is not something a page size
    // is allowed to hide.
    Booking.find({ adverseEvents: { $elemMatch: { acknowledgedAt: null } } })
      .sort({ scheduledAt: -1 })
      .lean<EventBooking[]>(),
    // The closed history: this is the part that grows without bound, so this is
    // the part that is paged, by the database.
    paginate<EventBooking>(
      Booking,
      {
        "adverseEvents.0": { $exists: true },
        adverseEvents: { $not: { $elemMatch: { acknowledgedAt: null } } },
      },
      { sort: { scheduledAt: -1 }, paging }
    ),
  ]);
  const withEvents = [...openEventBookings, ...history.rows];

  const ids = [...blocked, ...withEvents].flatMap((b) => [b.patientId, b.nurseId].filter(Boolean));
  // The override rows carry a patient and a nurse too, or every one of them
  // reads "Unknown patient" and never says who is asking.
  ids.push(...rxRequests.flatMap((b) => [b.patientId, b.nurseId].filter(Boolean)));
  const people = await User.find({ _id: { $in: ids } }).lean<
    Array<{
      _id: unknown;
      name: string;
      phone?: string;
      patient?: { allergies?: string; currentMedications?: string };
    }>
  >();
  const byId = new Map(people.map((p) => [String(p._id), p]));
  const nameOf = (id: unknown, fallback: string) => (id ? (byId.get(String(id))?.name ?? fallback) : fallback);
  const openEvents = withEvents.reduce(
    (n, b) => n + b.adverseEvents.filter((e) => !e.acknowledgedAt).length,
    0
  );

  return (
    <ConsoleShell
      session={session}
      roleLabel="Physician"
      nav={nav}
      activeHref="/doctor/adverse"
      breadcrumb={["Clinical", "Escalations"]}
      title="Escalations"
      meta={
        /* Said in words a physician who has never used this page can read.
           "rx" appeared nowhere else on the screen, and "blocked" did not say
           what was blocked. The zeros are kept: on a page that is a list of
           three duties, "0 prescriptions waiting" is the useful answer. */
        <HeaderCounts
          items={[
            `${plural(blocked.length, "infusion")} blocked`,
            `${plural(rxRequests.length, "prescription")} waiting`,
            `${plural(openEvents, "reaction")} unreviewed`,
          ]}
        />
      }
    >
      <p className="t-body text-[var(--color-ink-2)] max-w-[76ch] mb-6" style={{ textWrap: "pretty" }}>
        Three things reach you here and nowhere else. A baseline reading outside its band stops the infusion until
        you say otherwise — the nurse cannot override it. A patient who cannot give their code leaves a nurse unable
        to open the prescription until you authorise it. And every adverse event a nurse files lands here the moment
        it is filed, from the patient&apos;s side.
      </p>

      {/* ---------------- Prescription override requests ---------------- */}
      {rxRequests.length > 0 && (
        <section className="mb-10">
          <h2 className="t-h3 mb-3">Prescriptions waiting on you</h2>
          <p className="t-body text-[var(--color-ink-2)] mb-4 max-w-[62ch]">
            A nurse is with a patient who cannot give their code. If you do not answer, the nurse may still proceed
            under their own name — it will be recorded and everyone told, including the patient.
          </p>
          <div className="flex flex-col gap-4">
            {rxRequests.map((b) => {
              const patient = byId.get(String(b.patientId));
              const waited = describeWait(b.rxOverride?.requestedAt);
              const chased =
                b.rxOverride?.lastAskedAt &&
                b.rxOverride?.requestedAt &&
                new Date(b.rxOverride.lastAskedAt).getTime() !== new Date(b.rxOverride.requestedAt).getTime()
                  ? b.rxOverride.lastAskedAt
                  : null;
              return (
                <Card key={String(b._id)} tone="caution" padding="p-6">
                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-start">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <span className="t-h3">{patient?.name ?? "Unknown patient"}</span>
                        <span className="t-data text-[13px] text-[var(--color-ink-3)]">
                          {b.bookingNo} · {b.dripName ?? "—"}
                        </span>
                        {waited && (
                          <Pill tone={chased ? "critical" : "caution"}>{chased ? `${waited} · chased` : waited}</Pill>
                        )}
                      </div>

                      {/* The same context line the card below carries: when the
                          session is, where it is, and which nurse is there. */}
                      <span className="t-small text-[var(--color-ink-2)]">
                        {formatDate(b.scheduledAt)} · {formatTime(b.scheduledAt)}
                        {b.location ? ` · ${WHERE[b.location] ?? b.location}` : ""} · nurse{" "}
                        {nameOf(b.nurseId, "unassigned")}
                      </span>

                      {/* Authorising this means letting THIS nurse read a
                          medical record without the patient's own code. Who is
                          asking, and what they said, is the decision. */}
                      <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 mt-1">
                        <span className="t-micro">
                          {nameOf(b.nurseId, "The nurse")} says
                        </span>
                        <p className="t-body text-[var(--color-ink-2)] mt-1">
                          {b.rxOverride?.reason ?? "No reason given."}
                        </p>
                      </div>

                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 m-0 mt-1">
                        <dt className="t-small text-[var(--color-ink-3)]">Asked</dt>
                        <dd className="t-small text-[var(--color-ink-2)] m-0">
                          {b.rxOverride?.requestedAt ? (
                            <>
                              {formatDate(b.rxOverride.requestedAt)} · {formatTime(b.rxOverride.requestedAt)}
                            </>
                          ) : (
                            "—"
                          )}
                          {chased ? ` · chased again ${formatTime(chased)}` : ""}
                        </dd>

                        <dt className="t-small text-[var(--color-ink-3)]">Session</dt>
                        <dd className="t-small text-[var(--color-ink-2)] m-0">
                          {b.status.replace(/_/g, " ")}
                          {b.address ? ` · ${b.address}` : ""}
                          {b.pincode ? ` ${b.pincode}` : ""}
                        </dd>

                        {/* The other way to settle identity: ring the patient
                            yourself. Worth having the number to hand. */}
                        <dt className="t-small text-[var(--color-ink-3)]">Patient</dt>
                        <dd className="t-small text-[var(--color-ink-2)] m-0">
                          {patient?.phone ? (
                            <a href={`tel:${patient.phone}`} className="t-data text-[13px]">
                              {patient.phone}
                            </a>
                          ) : (
                            "no number on file"
                          )}
                        </dd>
                      </dl>
                    </div>
                    <RxOverrideDecision bookingId={String(b._id)} bookingNo={b.bookingNo} />
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {/* ---------------- Blocked infusions ---------------- */}
      <section className="mb-10">
        <h2 className="t-h3 mb-3">Vitals awaiting your call</h2>
        {blocked.length === 0 ? (
          <EmptyState
            kind="cleared"
            title="Nothing is blocked"
            body="No session is waiting on you. When a nurse records a reading outside its reference range, it appears here with the number and the band it broke."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {blocked.map((b) => {
              const flaggedReadings = b.vitals.filter((v) => (v.outOfRange ?? []).length > 0);
              const latest = flaggedReadings[flaggedReadings.length - 1];
              const patient = byId.get(String(b.patientId));
              return (
                <Card key={String(b._id)} tone="critical" padding="p-6">
                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] items-start">
                    <div>
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <Link href={`/doctor/patients/${String(b.patientId)}`} className="t-h3 no-underline hover:no-underline">
                          {nameOf(b.patientId, "Unknown patient")}
                        </Link>
                        <span className="t-data text-[13px] text-[var(--color-ink-3)]">
                          {b.bookingNo} · {b.dripName}
                        </span>
                      </div>
                      <span className="t-small text-[var(--color-ink-2)] block mt-1">
                        {formatDate(b.scheduledAt)} · {formatTime(b.scheduledAt)} · nurse{" "}
                        {nameOf(b.nurseId, "unassigned")}
                      </span>

                      <div className="rounded-[var(--radius-md)] bg-[var(--color-surface)] border border-[var(--color-critical)] p-4 mt-4">
                        <span className="t-micro text-[var(--color-critical-text)]">
                          Out of range · {latest ? formatTime(latest.takenAt) : ""}
                        </span>
                        <p className="t-body font-semibold mt-1">{latest ? describe(latest) : "—"}</p>
                        {latest && (
                          <p className="t-data text-[13px] text-[var(--color-ink-2)] mt-2">
                            {latest.systolic}/{latest.diastolic} · {latest.heartRate} bpm · SpO₂ {latest.spo2}% ·{" "}
                            {latest.temperatureF} °F
                          </p>
                        )}
                        {/* A reading the nurse corrected and is still out of range: what it said before. */}
                        <VitalsCorrected corrections={latest?.corrections} detail />
                      </div>

                      <div className="flex gap-2 flex-wrap mt-3">
                        {patient?.patient?.allergies && patient.patient.allergies.toLowerCase() !== "none" && (
                          <Pill tone="critical" dot>{patient.patient.allergies} allergy</Pill>
                        )}
                        {patient?.patient?.currentMedications &&
                          patient.patient.currentMedications.toLowerCase() !== "none" && (
                            <Pill tone="info">On {patient.patient.currentMedications}</Pill>
                          )}
                      </div>
                    </div>

                    <VitalsDecision bookingId={String(b._id)} bookingNo={b.bookingNo} />
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* ---------------- Adverse events ---------------- */}
      <section>
        <h2 className="t-h3 mb-3">
          Adverse events
          {openEvents > 0 ? ` · ${openEvents} awaiting your determination` : " · all closed"}
        </h2>
        {withEvents.length === 0 ? (
          <EmptyState
            kind="cleared"
            title="No adverse events"
            body="Nothing has been reported. Each one that is filed lands here immediately, with the session it came from."
          />
        ) : (
          <PagedView>
          <PagedResults>
          <div className="flex flex-col gap-4">
            {withEvents.flatMap((b) =>
              b.adverseEvents.map((e, i) => (
                <Card
                  key={`${String(b._id)}-${i}`}
                  tone={e.severity === "severe" ? "critical" : "surface"}
                  padding="p-6"
                >
                  <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <h3 className="t-h3">{nameOf(b.patientId, "Unknown patient")}</h3>
                        <span className="t-data text-[13px] text-[var(--color-ink-3)]">
                          {b.bookingNo} · {b.dripName}
                        </span>
                      </div>
                      <span className="t-small text-[var(--color-ink-2)] block mt-1">
                        {formatDate(e.at)} · {formatTime(e.at)} · reported by {nameOf(b.nurseId, "the attending nurse")}
                      </span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {e.severity && (
                        <Pill tone={SEVERITY_TONE[e.severity as keyof typeof SEVERITY_TONE] ?? "caution"} dot>
                          {e.severity.charAt(0).toUpperCase() + e.severity.slice(1)}
                        </Pill>
                      )}
                      {e.infusionStopped && <Pill tone="critical">Infusion stopped</Pill>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div>
                      <span className="t-micro block mb-2">Symptoms</span>
                      <div className="flex gap-2 flex-wrap">
                        {e.symptoms.map((s) => (
                          <Pill key={s} tone="critical">
                            {s}
                          </Pill>
                        ))}
                      </div>
                    </div>

                    {(e.actionsTaken ?? []).length > 0 && (
                      <div>
                        <span className="t-micro block mb-2">Actions taken</span>
                        <ul className="flex flex-col gap-1 list-none p-0 m-0">
                          {e.actionsTaken!.map((a) => (
                            <li key={a} className="t-body text-[var(--color-ink-2)]">
                              {a}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {e.notes && (
                    <p className="t-body text-[var(--color-ink-2)] mt-4 pt-4 border-t border-[var(--color-line)]">
                      {e.notes}
                    </p>
                  )}

                  <div className="mt-4 pt-4 border-t border-[var(--color-line)]">
                    {e.acknowledgedAt ? (
                      <div className="flex flex-col gap-1">
                        <span className="t-micro" style={{ color: "var(--color-safe)" }}>
                          Closed {formatDate(e.acknowledgedAt)} · {formatTime(e.acknowledgedAt)}
                        </span>
                        <span className="t-body text-[var(--color-ink-2)]">{e.determination}</span>
                      </div>
                    ) : (
                      <AdverseDecision
                        bookingId={String(b._id)}
                        eventId={String(e._id)}
                        bookingNo={b.bookingNo}
                      />
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
          </PagedResults>
          {history.meta.total > 0 ? (
            <>
              <p className="t-small text-[var(--color-ink-3)] mt-5">
                Every report still awaiting a determination is shown above in full. Closed reports are paged.
              </p>
              <Pagination
                meta={history.meta}
                basePath="/doctor/adverse"
                params={{ pageSize }}
                nouns={["closed report", "closed reports"]}
              />
            </>
          ) : null}
          </PagedView>
        )}
      </section>
    </ConsoleShell>
  );
}
