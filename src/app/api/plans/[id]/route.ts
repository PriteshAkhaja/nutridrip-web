import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Drip, TreatmentPlan, User } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { notify } from "@/lib/notify";
import { PLAN_STATUS, ROUTES, UNITS } from "@/lib/models/types";
import { componentsFromRecipe, type PlanComponentInput } from "@/lib/clinical/plan-input";
import { ok, fail, handleError } from "@/lib/api";

const Component = z.object({
  masterId: z.string().optional(),
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

const Patch = z.object({
  sharedWithNurse: z.boolean().optional(),
  nurseId: z.string().optional(),
  status: z.enum(PLAN_STATUS).optional(),
  diagnosis: z.string().max(500).optional(),

  /* The prescribing half. Present only when the plan itself is being rewritten. */
  startDate: z.string().optional(),
  totalWeeks: z.number().int().min(1).max(52).optional(),
  weeks: z
    .array(z.object({ weekNum: z.number().int().min(1), sessions: z.array(PlanSession) }))
    .optional(),
  patientAge: z.string().max(20).optional(),
  patientWeightKg: z.number().positive().max(500).optional(),
  patientHeightCm: z.number().positive().max(300).optional(),
  bloodGroup: z.string().max(8).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "plans.share")) return fail("Not permitted", 403);

    const { id } = await params;
    const body = (await req.json()) as Record<string, unknown>;
    const sent = new Set(Object.keys(body ?? {}));
    const input = Patch.parse(body);

    // Sharing a plan and rewriting its doses are different acts. Only somebody
    // who may write a prescription may change what is in one.
    const rewriting = input.weeks !== undefined;
    if (rewriting && !can(session?.role, "plans.create")) {
      return fail("Only a physician changes what a plan prescribes", 403);
    }

    await connectDB();

    const plan = await TreatmentPlan.findById(id);
    if (!plan) return fail("Plan not found", 404);
    // A plan is a prescribing act signed by one physician. Another physician
    // may read it, but changing whose doses a nurse will draw is not theirs.
    if (session!.role === "doctor" && String(plan.doctorId) !== session!.sub) {
      return fail("Another physician wrote this plan. Ask them to change it.", 403);
    }

    const wasShared = plan.sharedWithNurse;
    // What it said before, kept on the audit row: a plan can be rewritten, and
    // the version a nurse may already have read has to remain recoverable.
    const before = rewriting
      ? {
          startDate: plan.startDate,
          totalWeeks: plan.totalWeeks,
          weeks: JSON.parse(JSON.stringify(plan.weeks)),
        }
      : undefined;

    if (input.diagnosis !== undefined) plan.diagnosis = input.diagnosis;
    if (input.nurseId) plan.nurseId = input.nurseId;
    if (input.sharedWithNurse !== undefined) plan.sharedWithNurse = input.sharedWithNurse;
    if (input.status) plan.status = input.status;

    // `sent` rather than `!== undefined`: clearing a recorded weight has to be
    // possible, and an absent key is not the same as an empty one.
    if (sent.has("patientAge")) plan.patientAge = input.patientAge;
    if (sent.has("patientWeightKg")) plan.patientWeightKg = input.patientWeightKg;
    if (sent.has("patientHeightCm")) plan.patientHeightCm = input.patientHeightCm;
    if (sent.has("bloodGroup")) plan.bloodGroup = input.bloodGroup;
    if (input.startDate) plan.startDate = new Date(input.startDate);

    if (input.weeks) {
      const weeks = [];
      for (const w of input.weeks) {
        const sessions = [];
        for (const s of w.sessions) {
          let components: PlanComponentInput[] = s.components;
          if (components.length === 0 && s.dripId) {
            const drip = await Drip.findById(s.dripId).lean<{
              ingredients: Array<{ masterId?: unknown; name?: string; dose: number; unit: string; role: string }>;
            } | null>();
            components = componentsFromRecipe(drip?.ingredients ?? []);
          }
          sessions.push({ ...s, date: new Date(s.date), components });
        }
        weeks.push({ weekNum: w.weekNum, sessions });
      }
      plan.weeks = weeks;
      plan.totalWeeks = input.totalWeeks ?? weeks.length;
    } else if (input.totalWeeks) {
      plan.totalWeeks = input.totalWeeks;
    }

    // Sharing is what turns a draft into something a nurse can act on.
    if (plan.sharedWithNurse && plan.status === "draft") plan.status = "active";
    await plan.save();

    const patient = await User.findById(plan.patientId).lean<{ name: string } | null>();

    const justShared = plan.sharedWithNurse && !wasShared;

    if (justShared && plan.nurseId) {
      await notify(
        String(plan.nurseId),
        `Treatment plan shared · ${patient?.name ?? "a patient"}`,
        `${plan.totalWeeks} weeks of sessions to run.`,
        "info",
        `/nurse/plan/${id}`
      );
    } else if (rewriting && plan.sharedWithNurse && plan.nurseId) {
      // The nurse is holding a copy that has just stopped being true.
      await notify(
        String(plan.nurseId),
        `Treatment plan changed · ${patient?.name ?? "a patient"}`,
        "The physician has rewritten the schedule. Read it again before the next session.",
        "warning",
        `/nurse/plan/${id}`
      );
    }
    // Only once the plan has left draft: until then it has been shared with
    // nobody, and a bell about a plan the patient cannot open is worse than no
    // bell at all. Sharing a draft written earlier is the patient's first
    // sight of it, so that is when they are told it exists.
    if (justShared) {
      await notify(
        String(plan.patientId),
        "Your physician has written a treatment plan",
        `${plan.totalWeeks} weeks${plan.diagnosis ? ` · ${plan.diagnosis}` : ""}`,
        "info",
        `/app/plan/${id}`
      );
    } else if (rewriting && plan.status !== "draft") {
      await notify(
        String(plan.patientId),
        "Your physician has changed your treatment plan",
        `${plan.totalWeeks} weeks${plan.diagnosis ? ` · ${plan.diagnosis}` : ""}`,
        "info",
        `/app/plan/${id}`
      );
    }

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: rewriting ? "plan.rewrite" : "plan.update",
      entity: "TreatmentPlan",
      entityId: id,
      before,
      after: {
        shared: plan.sharedWithNurse,
        status: plan.status,
        ...(rewriting
          ? {
              startDate: plan.startDate,
              totalWeeks: plan.totalWeeks,
              sessions: plan.weeks.reduce(
                (n: number, w: { sessions: unknown[] }) => n + w.sessions.length,
                0
              ),
            }
          : {}),
      },
    });

    return ok({ id, sharedWithNurse: plan.sharedWithNurse, status: plan.status });
  } catch (err) {
    return handleError(err);
  }
}
