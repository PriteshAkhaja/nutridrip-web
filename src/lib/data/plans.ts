import { connectDB } from "@/lib/db/mongoose";
import { TreatmentPlan, User } from "@/lib/models";
import { formatDate } from "@/lib/data/inventory";

/**
 * A treatment plan as the nurse and the patient read it.
 *
 * Dates are formatted here rather than in the page, so the server and the
 * browser cannot render two different strings for the same day.
 */

export type PlanComponentView = {
  name: string;
  dose: number;
  unit: string;
  route: string;
  carrier?: string;
};

export type PlanSessionView = {
  key: string;
  weekNum: number;
  date: string;
  dripName: string;
  components: PlanComponentView[];
  note?: string;
  /** Its day has passed. Not the same as "it was run" — that lives on the booking. */
  past: boolean;
};

export type PlanView = {
  id: string;
  patientName: string;
  doctorName: string;
  nurseName?: string;
  diagnosis?: string;
  startDate?: string;
  totalWeeks: number;
  status: string;
  sessions: PlanSessionView[];
  sessionsPast: number;
  writtenOn: string;
};

type PlanDoc = {
  _id: unknown;
  patientId: unknown;
  doctorId: unknown;
  nurseId?: unknown;
  diagnosis?: string;
  startDate?: Date;
  totalWeeks: number;
  sharedWithNurse: boolean;
  status: string;
  createdAt: Date;
  weeks: Array<{
    weekNum: number;
    sessions: Array<{
      date: Date;
      dripName: string;
      components?: PlanComponentView[];
      sessionNotes?: string;
    }>;
  }>;
};

/**
 * May this person read this plan?
 *
 * Role alone is never the answer. A nurse reads a plan only when it was shared
 * with *them*; a patient reads only their own; a physician reads only what
 * they wrote. A draft has been shared with nobody, so it stays with its author
 * — the screen says a plan is a draft until you share it, and that has to be
 * true of who can see it, not only of what it is called.
 */
function mayRead(plan: PlanDoc, viewer: { sub: string; role: string }): boolean {
  if (viewer.role === "superadmin") return true;
  if (viewer.role === "doctor") return String(plan.doctorId) === viewer.sub;
  if (viewer.role === "nurse") {
    return plan.sharedWithNurse && String(plan.nurseId) === viewer.sub;
  }
  if (viewer.role === "patient") {
    return String(plan.patientId) === viewer.sub && plan.status !== "draft";
  }
  return false;
}

function shape(plan: PlanDoc, names: Map<string, string>): PlanView {
  const now = Date.now();
  const sessions = plan.weeks.flatMap((w) =>
    w.sessions.map((s, i) => ({
      key: `${w.weekNum}-${i}`,
      weekNum: w.weekNum,
      date: formatDate(s.date),
      dripName: s.dripName,
      components: s.components ?? [],
      note: s.sessionNotes || undefined,
      past: new Date(s.date).getTime() < now,
    }))
  );

  return {
    id: String(plan._id),
    patientName: names.get(String(plan.patientId)) ?? "—",
    doctorName: names.get(String(plan.doctorId)) ?? "—",
    nurseName: plan.nurseId ? names.get(String(plan.nurseId)) : undefined,
    diagnosis: plan.diagnosis || undefined,
    startDate: plan.startDate ? formatDate(plan.startDate) : undefined,
    totalWeeks: plan.totalWeeks,
    status: plan.status,
    sessions,
    sessionsPast: sessions.filter((s) => s.past).length,
    writtenOn: formatDate(plan.createdAt),
  };
}

async function namesFor(plans: PlanDoc[]): Promise<Map<string, string>> {
  const ids = [
    ...new Set(
      plans.flatMap((p) =>
        [p.patientId, p.doctorId, p.nurseId].filter(Boolean).map((v) => String(v))
      )
    ),
  ];
  const users = await User.find({ _id: { $in: ids } })
    .select("name")
    .lean<Array<{ _id: unknown; name: string }>>();
  return new Map(users.map((u) => [String(u._id), u.name]));
}

/** One plan, or null when this person may not read it. */
export async function planFor(
  id: string,
  viewer: { sub: string; role: string }
): Promise<PlanView | null> {
  await connectDB();
  const plan = await TreatmentPlan.findById(id).lean<PlanDoc | null>();
  if (!plan || !mayRead(plan, viewer)) return null;
  return shape(plan, await namesFor([plan]));
}

/** Every plan this person may read, newest first. */
export async function plansFor(viewer: { sub: string; role: string }): Promise<PlanView[]> {
  await connectDB();

  const filter =
    viewer.role === "nurse"
      ? { nurseId: viewer.sub, sharedWithNurse: true, status: { $ne: "archived" } }
      : viewer.role === "patient"
        ? { patientId: viewer.sub, status: { $nin: ["draft", "archived"] } }
        : viewer.role === "doctor"
          ? { doctorId: viewer.sub }
          : {};

  const plans = await TreatmentPlan.find(filter)
    .sort({ createdAt: -1 })
    .limit(20)
    .lean<PlanDoc[]>();
  if (plans.length === 0) return [];

  const names = await namesFor(plans);
  return plans.map((p) => shape(p, names));
}
