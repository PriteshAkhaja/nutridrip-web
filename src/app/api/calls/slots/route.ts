import { connectDB } from "@/lib/db/mongoose";
import { Consultation } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { callGridFor } from "@/lib/data/calls";
import { hoursSummary } from "@/lib/clinical/calls";
import { ok, fail, handleError } from "@/lib/api";
import { getClockFormat } from "@/lib/settings/clock";

export const dynamic = "force-dynamic";

/**
 * A physician's call times for the next 7 days, each free, taken or too soon.
 * Same shape as /api/bookings/slots, so the one SlotPicker shows both.
 *
 *   ?doctorId=<id>   booking a new call;
 *   ?call=<id>       moving one — its own physician, and it does not block itself.
 */
export async function GET(req: Request) {
  const clockFmt = await getClockFormat();
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);
    const params = new URL(req.url).searchParams;
    await connectDB();

    let doctorId = params.get("doctorId");
    let excludeCallId: string | null = null;
    const callId = params.get("call");
    if (callId) {
      const call = await Consultation.findById(callId)
        .select("patientId doctorId")
        .lean<{ patientId: unknown; doctorId: unknown } | null>();
      if (!call) return fail("That call does not exist", 404);
      const mine = session.role === "patient" && String(call.patientId) === session.sub;
      const theirs = session.role === "doctor" && String(call.doctorId) === session.sub;
      if (!mine && !theirs && !can(session.role, "calls.manage")) return fail("Not permitted", 403);
      doctorId = String(call.doctorId);
      excludeCallId = callId;
    }
    if (!doctorId) return fail("Choose a physician", 422);

    const grid = await callGridFor(doctorId, excludeCallId);
    if (!grid) return ok({ served: false, zone: null, days: [] });
    return ok({
      served: true,
      zone: {
        name: grid.doctorName,
        window: hoursSummary(grid.hours, clockFmt),
        every: `${grid.hours.callMinutes}-min calls`,
      },
      days: grid.days,
    });
  } catch (err) {
    return handleError(err);
  }
}
