import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { connectDB } from "@/lib/db/mongoose";
import { TreatmentPlan, User } from "@/lib/models";
import { getContent } from "@/lib/content";
import { LogoMark } from "@/components/layout/Logo";
import { ageFrom } from "@/lib/data/clinical";
import { formatDate } from "@/lib/data/inventory";
import { PrintButton } from "./PrintButton";

export const metadata: Metadata = { title: "Prescription" };
export const dynamic = "force-dynamic";

type Component = { name: string; dose: number; unit: string; route: string; carrier?: string };

/**
 * The Rx slip. Everything the pharmacy, the nurse and the patient need on one
 * sheet: who prescribed, for whom, what, how, and in what order — signed with
 * the physician's council registration.
 */
export default async function PrintRxPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireRole("doctor", "superadmin");
  const { id } = await params;

  await connectDB();
  const plan = await TreatmentPlan.findById(id).lean<{
    _id: unknown;
    patientId: unknown;
    doctorId: unknown;
    nurseId?: unknown;
    diagnosis?: string;
    patientAge?: string;
    patientWeightKg?: number;
    patientHeightCm?: number;
    bloodGroup?: string;
    startDate?: Date;
    totalWeeks: number;
    status: string;
    createdAt: Date;
    weeks: Array<{ weekNum: number; sessions: Array<{ date: Date; dripName: string; components: Component[]; sessionNotes?: string }> }>;
  } | null>();
  if (!plan) notFound();
  // A physician prints their own prescriptions; the super admin may print any.
  if (session.role === "doctor" && String(plan.doctorId) !== session.sub) notFound();

  const [patient, doctor, nurse, copy] = await Promise.all([
    User.findById(plan.patientId).lean<{
      name: string;
      phone?: string;
      patient?: { dob?: Date; gender?: string; bloodGroup?: string; weightKg?: number; heightCm?: number; allergies?: string; address?: string; city?: string };
    } | null>(),
    User.findById(plan.doctorId).lean<{
      name: string;
      doctor?: { specialization?: string; licenseNo?: string; registrationCouncil?: string };
    } | null>(),
    plan.nurseId ? User.findById(plan.nurseId).lean<{ name: string } | null>() : Promise.resolve(null),
    getContent(),
  ]);

  const p = patient?.patient ?? {};
  const sessions = plan.weeks.flatMap((w) => w.sessions.map((s) => ({ ...s, weekNum: w.weekNum })));
  const rxNo = `RX-${String(plan._id).slice(-6).toUpperCase()}`;

  return (
    <div className="min-h-screen bg-[var(--color-surface-2)] print:bg-white py-8 print:py-0 px-4">
      {/* ---------------- Controls, hidden in print ---------------- */}
      <div className="no-print mx-auto max-w-[820px] flex items-center justify-between gap-4 mb-5 flex-wrap">
        <Link href="/doctor/plans" className="t-body">
          ← Back to plans
        </Link>
        <PrintButton />
      </div>

      {/* ---------------- The sheet ---------------- */}
      <article className="rx-page mx-auto max-w-[820px] bg-white border border-[var(--color-line)] rounded-[var(--radius-lg)] p-8 md:p-12 print:border-0 print:rounded-none print:p-0">
        <header className="flex items-start justify-between gap-6 pb-6 border-b-2 border-[var(--color-ink)]">
          <div className="flex items-center gap-3">
            <LogoMark size={28} />
            <div className="flex flex-col">
              <span style={{ font: "600 20px/1 var(--font-display)", letterSpacing: "-0.01em" }}>NutriDrip</span>
              <span className="t-small text-[var(--color-ink-3)] mt-1">{copy["footer.legalName"]}</span>
              <span className="t-small text-[var(--color-ink-3)]">
                Clinical establishment reg. <span className="t-data">{copy["footer.registration"]}</span>
              </span>
            </div>
          </div>
          <div className="text-right">
            <span style={{ font: "700 34px/1 var(--font-display)" }}>℞</span>
            <div className="t-data text-[13px] mt-2">{rxNo}</div>
            <div className="t-small text-[var(--color-ink-3)]">{formatDate(plan.createdAt)}</div>
          </div>
        </header>

        <section className="grid gap-6 md:grid-cols-2 py-6 border-b border-[var(--color-line)]">
          <div>
            <span className="t-micro">Patient</span>
            <div className="t-h3 mt-1">{patient?.name ?? "—"}</div>
            <div className="t-small text-[var(--color-ink-2)] mt-1">
              {[
                plan.patientAge ? `${plan.patientAge} y` : ageFrom(p.dob),
                // Stored lowercase on the record; a prescription is a formal
                // document and "male" in the middle of one reads as a typo.
                p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : "—",
                plan.bloodGroup ?? p.bloodGroup ?? "—",
                (plan.patientWeightKg ?? p.weightKg) ? `${plan.patientWeightKg ?? p.weightKg} kg` : null,
                (plan.patientHeightCm ?? p.heightCm) ? `${plan.patientHeightCm ?? p.heightCm} cm` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
            {patient?.phone && <div className="t-data text-[13px] mt-1">{patient.phone}</div>}
            {(p.address || p.city) && (
              <div className="t-small text-[var(--color-ink-2)] mt-1">{[p.address, p.city].filter(Boolean).join(", ")}</div>
            )}
            <div className="t-small mt-2" style={{ color: p.allergies && p.allergies.toLowerCase() !== "none" ? "var(--color-critical)" : "var(--color-ink-2)" }}>
              Allergies: {p.allergies || "None declared"}
            </div>
          </div>
          <div>
            <span className="t-micro">Prescribing physician</span>
            <div className="t-h3 mt-1">{doctor?.name ?? "—"}</div>
            <div className="t-small text-[var(--color-ink-2)] mt-1">{doctor?.doctor?.specialization ?? "—"}</div>
            <div className="t-data text-[13px] mt-1">
              {doctor?.doctor?.registrationCouncil ?? "—"} · {doctor?.doctor?.licenseNo ?? "—"}
            </div>
            {nurse && <div className="t-small text-[var(--color-ink-2)] mt-2">Administering nurse: {nurse.name}</div>}
          </div>
        </section>

        <section className="py-6 border-b border-[var(--color-line)]">
          <span className="t-micro">Diagnosis / primary concern</span>
          <p className="t-body-lg mt-1">{plan.diagnosis || "—"}</p>
          <div className="flex gap-8 flex-wrap mt-3 t-small text-[var(--color-ink-2)]">
            <span>
              Course: <span className="t-data">{plan.totalWeeks}</span> week{plan.totalWeeks === 1 ? "" : "s"}
            </span>
            <span>
              Starts: <span className="t-data">{plan.startDate ? formatDate(plan.startDate) : "—"}</span>
            </span>
            <span>
              Sessions: <span className="t-data">{sessions.length}</span>
            </span>
          </div>
        </section>

        <section className="py-6">
          <span className="t-micro block mb-3">Schedule</span>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-[var(--color-ink)]">
                <th className="t-micro text-left py-2 pr-3 w-[60px]">Week</th>
                <th className="t-micro text-left py-2 pr-3 w-[110px]">Date</th>
                <th className="t-micro text-left py-2 pr-3">Protocol and components</th>
                <th className="t-micro text-left py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => (
                <tr key={i} className="border-b border-[var(--color-line)] align-top" style={{ breakInside: "avoid" }}>
                  <td className="t-data text-[13px] py-3 pr-3">W{s.weekNum}</td>
                  <td className="t-data text-[13px] py-3 pr-3">{formatDate(s.date)}</td>
                  <td className="py-3 pr-3">
                    <div className="t-body font-semibold">{s.dripName}</div>
                    {s.components.length > 0 ? (
                      <ul className="list-none p-0 m-0 mt-1 flex flex-col gap-[2px]">
                        {s.components.map((c, n) => (
                          <li key={n} className="t-small text-[var(--color-ink-2)]">
                            <span className="t-data text-[13px] text-[var(--color-ink)]">
                              {c.name} {c.dose.toLocaleString("en-IN")} {c.unit}
                            </span>{" "}
                            — {c.route}
                            {c.carrier && c.carrier !== "—" ? ` in ${c.carrier}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="t-small text-[var(--color-ink-3)]">As per the standard recipe</span>
                    )}
                  </td>
                  <td className="t-small text-[var(--color-ink-2)] py-3">{s.sessionNotes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <footer className="pt-8 grid gap-8 md:grid-cols-[1fr_260px] items-end">
          <p className="t-small text-[var(--color-ink-3)]" style={{ textWrap: "pretty" }}>
            Valid for the course above only. Each session is administered by a council-registered nurse against the
            29-step checklist, after baseline vitals, and is not to be dispensed or administered elsewhere.
            {copy["footer.emergency"] ? ` ${copy["footer.emergency"]}` : ""}
          </p>
          <div>
            <div className="h-[56px] border-b border-[var(--color-ink)]" />
            <div className="t-small mt-2">{doctor?.name}</div>
            <div className="t-data text-[13px] text-[var(--color-ink-2)]">{doctor?.doctor?.licenseNo ?? ""}</div>
            <div className="t-small text-[var(--color-ink-3)]">Signature and stamp</div>
          </div>
        </footer>
      </article>
    </div>
  );
}
