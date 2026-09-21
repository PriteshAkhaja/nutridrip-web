import { connectDB } from "@/lib/db/mongoose";
import { Booking, HealthQuiz, LabReport, User } from "@/lib/models";
import { riskBand, riskColor } from "@/lib/models/types";

const HOUR = 3_600_000;
/** How long a physician has to review a submission before it breaches. */
export const REVIEW_SLA_HOURS = 6;

export type ReviewFlag = { label: string; kind: "crit" | "warn" | "info" };

export type QueueItem = {
  quizId: string;
  patientId: string;
  name: string;
  age: string;
  gender: string;
  bookingNo: string | null;
  dripName: string | null;
  slot: string | null;
  vitalityScore: number;
  flags: ReviewFlag[];
  /** Milliseconds left on the review SLA; negative when breached. */
  msLeft: number;
  slaLabel: string;
  slaPct: number;
  submittedAt: string;
};

export function ageFrom(dob?: Date | null): string {
  if (!dob) return "—";
  const years = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * HOUR));
  return `${years} y`;
}

/**
 * Flags are the things a physician must not miss: an allergy, a stale lab, a
 * medication interaction. They are computed here so the queue and the review
 * screen never disagree.
 */
function flagsFor(patient: {
  patient?: {
    allergies?: string;
    chronicConditions?: string;
    currentMedications?: string;
  };
}): ReviewFlag[] {
  const p = patient.patient ?? {};
  const flags: ReviewFlag[] = [];

  if (p.allergies && p.allergies.toLowerCase() !== "none") {
    flags.push({ label: `${p.allergies} allergy`, kind: "crit" });
  }
  if (p.chronicConditions && p.chronicConditions.toLowerCase() !== "none") {
    flags.push({ label: p.chronicConditions, kind: "warn" });
  }
  if (p.currentMedications && p.currentMedications.toLowerCase() !== "none") {
    flags.push({ label: `On ${p.currentMedications}`, kind: "info" });
  }
  return flags;
}

function slaOf(submittedAt: Date): { msLeft: number; label: string; pct: number } {
  const deadline = submittedAt.getTime() + REVIEW_SLA_HOURS * HOUR;
  const msLeft = deadline - Date.now();
  const pct = Math.max(0, Math.min(100, (msLeft / (REVIEW_SLA_HOURS * HOUR)) * 100));

  if (msLeft < 0) {
    const over = Math.floor(-msLeft / HOUR);
    return { msLeft, label: over >= 1 ? `${over}h overdue` : "Overdue", pct: 0 };
  }
  const h = Math.floor(msLeft / HOUR);
  const m = Math.floor((msLeft % HOUR) / 60_000);
  return { msLeft, label: `${h}:${String(m).padStart(2, "0")} left`, pct };
}

/** The approvals queue, ordered by how close each submission is to breaching. */
export async function reviewQueue(): Promise<QueueItem[]> {
  await connectDB();

  const quizzes = await HealthQuiz.find({ reviewStatus: "pending" })
    .sort({ completedAt: 1 })
    .lean<
      Array<{
        _id: unknown;
        patientId: unknown;
        vitalityScore: number;
        completedAt: Date;
      }>
    >();

  const patients = await User.find({ _id: { $in: quizzes.map((q) => q.patientId) } }).lean<
    Array<{
      _id: unknown;
      name: string;
      patient?: {
        dob?: Date;
        gender?: string;
        allergies?: string;
        chronicConditions?: string;
        currentMedications?: string;
      };
    }>
  >();
  const patientById = new Map(patients.map((p) => [String(p._id), p]));

  const bookings = await Booking.find({
    patientId: { $in: quizzes.map((q) => q.patientId) },
    status: { $in: ["awaiting_review", "nurse_assigned", "approved"] },
  })
    .sort({ scheduledAt: 1 })
    .lean<Array<{ patientId: unknown; bookingNo: string; dripName?: string; scheduledAt: Date }>>();

  const bookingByPatient = new Map<string, (typeof bookings)[number]>();
  for (const b of bookings) {
    const k = String(b.patientId);
    if (!bookingByPatient.has(k)) bookingByPatient.set(k, b);
  }

  const items = quizzes.map((q) => {
    const patient = patientById.get(String(q.patientId));
    const booking = bookingByPatient.get(String(q.patientId));
    const sla = slaOf(q.completedAt);

    return {
      quizId: String(q._id),
      patientId: String(q.patientId),
      name: patient?.name ?? "Unknown patient",
      age: ageFrom(patient?.patient?.dob),
      gender: patient?.patient?.gender?.charAt(0).toUpperCase() ?? "—",
      bookingNo: booking?.bookingNo ?? null,
      dripName: booking?.dripName ?? null,
      slot: booking
        ? booking.scheduledAt.toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })
        : null,
      vitalityScore: q.vitalityScore,
      flags: patient ? flagsFor(patient) : [],
      msLeft: sla.msLeft,
      slaLabel: sla.label,
      slaPct: sla.pct,
      submittedAt: q.completedAt.toISOString(),
    };
  });

  return items.sort((a, b) => a.msLeft - b.msLeft);
}

export type NutrientMarker = {
  name: string;
  group?: string;
  pct: number;
  band: string;
  color: string;
};

export type PatientReview = {
  quizId: string;
  patient: {
    id: string;
    name: string;
    age: string;
    gender: string;
    bloodGroup?: string;
    weightKg?: number;
    heightCm?: number;
    phone?: string;
  };
  /** Where the session would happen — what the nurse list is ranked against. */
  location: { latitude: number | null; longitude: number | null; pincode: string | null };
  vitalityScore: number;
  markers: NutrientMarker[];
  history: Array<{ label: string; value: string; tone: "plain" | "alert" | "data" }>;
  flags: ReviewFlag[];
  answers: Array<{ section?: string; question?: string; answer: unknown }>;
  suggestedDrips: Array<{ id: string; name: string; slug: string }>;
  submittedAt: string;
  reviewStatus: string;
  /** A question already asked of the patient, and their reply. */
  infoRequest: string | null;
  infoAnswer: string | null;
  /**
   * Blood work and scans the patient uploaded. On the review screen because
   * that is where the decision is made — they were visible only on a separate
   * patient page, and only as file names nobody could open.
   */
  labReports: Array<{
    id: string;
    fileName: string;
    category: string | null;
    notes: string | null;
    uploadedAt: string;
    /** False for rows that carry a name and no file. */
    hasFile: boolean;
  }>;
  previousSessions: number;
  lastSessionAt: string | null;
};

export async function patientReview(quizId: string): Promise<PatientReview | null> {
  await connectDB();

  const quiz = await HealthQuiz.findById(quizId).lean<{
    _id: unknown;
    patientId: unknown;
    vitalityScore: number;
    nutrientRisks: Array<{ name: string; group?: string; pct: number }>;
    answers: Array<{ section?: string; question?: string; answer: unknown }>;
    suggestedDripIds: unknown[];
    completedAt: Date;
    reviewStatus: string;
    infoRequest?: string;
    infoAnswer?: string;
  } | null>();
  if (!quiz) return null;

  /**
   * The file itself is deliberately not selected — it is a base64 data URL of
   * up to 4 MB, and this page only needs to know it exists. Opening it goes
   * through /api/lab-reports/[id]/file.
   */
  // Every report, not the latest twenty: a physician approving an iron protocol
  // may be looking for an older ferritin, and a cut-off list would hide it
  // without saying so. The rows are small because the file is not read.
  const labs = await LabReport.find({ patientId: quiz.patientId })
    .sort({ uploadedAt: -1 })
    .select({ fileName: 1, category: 1, notes: 1, uploadedAt: 1, hasFile: { $gt: [{ $strLenCP: { $ifNull: ["$fileUrl", ""] } }, 0] } })
    .lean<Array<{ _id: unknown; fileName: string; category?: string; notes?: string; uploadedAt: Date; hasFile?: boolean }>>();

  const patient = await User.findById(quiz.patientId).lean<{
    _id: unknown;
    name: string;
    phone?: string;
    patient?: {
      dob?: Date;
      gender?: string;
      bloodGroup?: string;
      weightKg?: number;
      heightCm?: number;
      allergies?: string;
      chronicConditions?: string;
      currentMedications?: string;
      surgeries?: string;
      latitude?: number;
      longitude?: number;
      pincode?: string;
    };
  } | null>();
  if (!patient) return null;

  const { Drip } = await import("@/lib/models");
  const suggested = await Drip.find({ _id: { $in: quiz.suggestedDripIds } }).lean<
    Array<{ _id: unknown; name: string; slug: string }>
  >();

  const past = await Booking.find({ patientId: quiz.patientId, status: "completed" })
    .sort({ completedAt: -1 })
    .lean<Array<{ completedAt?: Date }>>();

  const p = patient.patient ?? {};
  const bmi =
    p.weightKg && p.heightCm ? (p.weightKg / (p.heightCm / 100) ** 2).toFixed(1) : null;

  return {
    quizId: String(quiz._id),
    patient: {
      id: String(patient._id),
      name: patient.name,
      age: ageFrom(p.dob),
      gender: p.gender ?? "—",
      bloodGroup: p.bloodGroup,
      weightKg: p.weightKg,
      heightCm: p.heightCm,
      phone: patient.phone,
    },
    location: {
      latitude: p.latitude ?? null,
      longitude: p.longitude ?? null,
      pincode: p.pincode ?? null,
    },
    vitalityScore: quiz.vitalityScore,
    markers: (quiz.nutrientRisks ?? []).map((r) => ({
      name: r.name,
      group: r.group,
      pct: r.pct,
      band: riskBand(r.pct),
      color: riskColor(r.pct),
    })),
    history: [
      {
        label: "Allergies",
        value: p.allergies || "None declared",
        tone: p.allergies && p.allergies.toLowerCase() !== "none" ? "alert" : "plain",
      },
      { label: "Current medication", value: p.currentMedications || "None declared", tone: "plain" },
      { label: "Conditions", value: p.chronicConditions || "None declared", tone: "plain" },
      { label: "Past surgeries", value: p.surgeries || "None declared", tone: "plain" },
      {
        label: "Previous IV sessions",
        value: past.length
          ? `${past.length} · last ${past[0].completedAt?.toLocaleDateString("en-IN", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}`
          : "None",
        tone: "data",
      },
      {
        label: "Weight · BMI",
        value: p.weightKg ? `${p.weightKg} kg${bmi ? ` · ${bmi}` : ""}` : "Not recorded",
        tone: "data",
      },
    ],
    flags: flagsFor(patient),
    answers: quiz.answers ?? [],
    suggestedDrips: suggested.map((d) => ({ id: String(d._id), name: d.name, slug: d.slug })),
    submittedAt: quiz.completedAt.toISOString(),
    reviewStatus: quiz.reviewStatus,
    infoRequest: quiz.infoRequest ?? null,
    infoAnswer: quiz.infoAnswer ?? null,
    labReports: labs.map((l) => ({
      id: String(l._id),
      fileName: l.fileName,
      category: l.category ?? null,
      notes: l.notes ?? null,
      uploadedAt: new Date(l.uploadedAt).toISOString(),
      // Checked without pulling the file itself into memory: a data URL is
      // megabytes, and this only needs to know whether there is one.
      hasFile: Boolean(l.hasFile),
    })),
    previousSessions: past.length,
    lastSessionAt: past[0]?.completedAt?.toISOString() ?? null,
  };
}
