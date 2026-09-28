import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Consultation, DoctorHours, User } from "@/lib/models";
import { getSession, type SessionPayload } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { callClash, callWhen, hoursProblem, hoursSummary } from "@/lib/clinical/calls";
import { hoursOf } from "@/lib/data/calls";
import { ok, fail, handleError } from "@/lib/api";
import { getClockFormat } from "@/lib/settings/clock";
import { clockText } from "@/lib/time";

export const dynamic = "force-dynamic";

const Hours = z.object({
  weekly: z
    .array(z.object({ day: z.number().int().min(0).max(6), start: z.string().max(5), end: z.string().max(5) }))
    .max(28),
  callMinutes: z.number().int(),
  daysOff: z.array(z.string().max(10)).max(366),
});

/** A physician sets their own hours; the super admin sets anyone's. */
function mayEdit(session: SessionPayload | null, doctorId: string) {
  if (!session) return false;
  if (session.role === "doctor") return session.sub === doctorId;
  return can(session.role, "calls.manage");
}

/** Booked calls that no longer fit the hours: listed to move or hand over, never cancelled silently. */
async function clashesFor(doctorId: string) {
  const clockFmt = await getClockFormat();
  const hours = await hoursOf(doctorId);
  if (!hours) return [];
  const calls = await Consultation.find({ doctorId, status: "booked", startAt: { $gte: new Date() } })
    .sort({ startAt: 1 })
    .select("callNo startAt minutes")
    .lean<Array<{ _id: unknown; callNo: string; startAt: Date; minutes: number }>>();
  return calls
    .map((c) => ({
      id: String(c._id),
      callNo: c.callNo,
      when: callWhen(c.startAt, clockFmt),
      reason: callClash(hours, c.startAt, c.minutes),
    }))
    .filter((c) => c.reason);
}

export async function GET(_req: Request, { params }: { params: Promise<{ doctorId: string }> }) {
  try {
    const session = await getSession();
    const { doctorId } = await params;
    if (!mayEdit(session, doctorId) && !can(session?.role, "calls.view")) return fail("Not permitted", 403);
    await connectDB();
    return ok({ hours: await hoursOf(doctorId), clashes: await clashesFor(doctorId) });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ doctorId: string }> }) {
  const clockFmt = await getClockFormat();
  try {
    const session = await getSession();
    const { doctorId } = await params;
    if (!mayEdit(session, doctorId)) return fail("You can change only your own hours", 403);
    const input = Hours.parse(await req.json());
    await connectDB();

    const doctor = await User.findOne({ _id: doctorId, role: "doctor" }).select("name").lean<{ name: string } | null>();
    if (!doctor) return fail("That is not a physician", 404);

    const hours = {
      weekly: input.weekly,
      callMinutes: input.callMinutes,
      // Past days off are dropped as they pass; the list is only what is still ahead.
      daysOff: [...new Set(input.daysOff)].sort(),
    };
    const problem = hoursProblem(hours);
    if (problem) return fail(clockText(problem, clockFmt), 422);

    const before = await hoursOf(doctorId);
    await DoctorHours.updateOne(
      { doctorId },
      { $set: { ...hours, updatedBy: session!.sub } },
      { upsert: true, setDefaultsOnInsert: true }
    );
    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "hours.update",
      entity: "User",
      entityId: doctorId,
      before: before
        ? { hours: hoursSummary(before, "24h"), callMinutes: before.callMinutes, daysOff: before.daysOff.join(", ") }
        : null,
      after: {
        doctor: doctor.name,
        hours: hoursSummary(hours, "24h"),
        callMinutes: hours.callMinutes,
        daysOff: hours.daysOff.join(", "),
      },
    });
    return ok({ hours, clashes: await clashesFor(doctorId) });
  } catch (err) {
    return handleError(err);
  }
}
