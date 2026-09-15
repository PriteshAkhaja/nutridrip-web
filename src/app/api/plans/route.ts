import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Drip, TreatmentPlan, User } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { notify } from "@/lib/notify";
import { ROUTES, UNITS } from "@/lib/models/types";
import { ok, fail, handleError } from "@/lib/api";

const Component = z.object({
  name: z.string().min(1).max(120),
  dose: z.number().positive(),
  unit: z.enum(UNITS),
  route: z.enum(ROUTES),
  carrier: z.string().max(80).optional(),
});

const PlanSession = z.object({
  date: z.string(),
  dripId: z.string().optional(),
  dripName: z.string().min(1).max(120),
  components: z.array(Component).default([]),
  sessionNotes: z.string().max(1000).optional(),
});

const CreatePlan = z.object({
  patientId: z.string(),
  diagnosis: z.string().max(500).optional(),
  startDate: z.string(),
  totalWeeks: z.number().int().min(1).max(52).default(4),
  weeks: z.array(z.object({ weekNum: z.number().int().min(1), sessions: z.array(PlanSession) })).default([]),
  sharedWithNurse: z.boolean().default(false),
  nurseId: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "plans.view")) return fail("Not permitted", 403);

    await connectDB();
    const patientId = new URL(req.url).searchParams.get("patientId");
    const filter: Record<string, unknown> = {};
    // Each role sees only the plans they are party to.
    if (session!.role === "patient") filter.patientId = session!.sub;
    else if (session!.role === "doctor") filter.doctorId = session!.sub;
    else if (session!.role === "nurse") {
      filter.nurseId = session!.sub;
      filter.sharedWithNurse = true;
    } else if (patientId) filter.patientId = patientId;

    const plans = await TreatmentPlan.find(filter).sort({ createdAt: -1 }).limit(100).lean();
    return ok({ plans });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "plans.create")) return fail("Only a physician writes a plan", 403);

    const input = CreatePlan.parse(await req.json());
    await connectDB();

    const patient = await User.findById(input.patientId).lean<{
      name: string;
      role: string;
      patient?: { dob?: Date; weightKg?: number; heightCm?: number; bloodGroup?: string };
    } | null>();
    if (!patient || patient.role !== "patient") return fail("That is not a patient account", 422);

    // Fill in each session's components from the drip when they were not typed.
    const weeks = [];
    for (const w of input.weeks) {
      const sessions = [];
      for (const s of w.sessions) {
        let components = s.components;
        if (components.length === 0 && s.dripId) {
          const drip = await Drip.findById(s.dripId).lean<{
            ingredients: Array<{ name?: string; dose: number; unit: string; role: string }>;
          } | null>();
          components = (drip?.ingredients ?? []).map((i) => ({
            name: i.name ?? "",
            dose: i.dose,
            unit: i.unit as (typeof UNITS)[number],
            route: (i.role === "FLUID" ? "IV Drip in NS" : "Add to Drip Bag") as (typeof ROUTES)[number],
            carrier: i.role === "FLUID" ? undefined : "NS 500 ml",
          }));
        }
        sessions.push({ ...s, date: new Date(s.date), components });
      }
      weeks.push({ weekNum: w.weekNum, sessions });
    }

    const age = patient.patient?.dob
      ? String(Math.floor((Date.now() - new Date(patient.patient.dob).getTime()) / (365.25 * 86_400_000)))
      : undefined;

    const plan = await TreatmentPlan.create({
      patientId: input.patientId,
      doctorId: session!.sub,
      nurseId: input.nurseId,
      diagnosis: input.diagnosis,
      patientAge: age,
      patientWeightKg: patient.patient?.weightKg,
      patientHeightCm: patient.patient?.heightCm,
      bloodGroup: patient.patient?.bloodGroup,
      startDate: new Date(input.startDate),
      totalWeeks: input.totalWeeks,
      weeks,
      sharedWithNurse: input.sharedWithNurse,
      status: input.sharedWithNurse ? "active" : "draft",
    });

    await notify(
      input.patientId,
      "Your physician has written a treatment plan",
      `${input.totalWeeks} weeks${input.diagnosis ? ` · ${input.diagnosis}` : ""}`,
      "info",
      "/app"
    );
    if (input.sharedWithNurse && input.nurseId) {
      await notify(
        input.nurseId,
        `Treatment plan shared · ${patient.name}`,
        `${input.totalWeeks} weeks of sessions to run.`,
        "info",
        "/nurse/schedule"
      );
    }

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "plan.create",
      entity: "TreatmentPlan",
      entityId: String(plan._id),
      after: { patient: patient.name, weeks: input.totalWeeks },
    });

    return ok({ id: String(plan._id) }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
