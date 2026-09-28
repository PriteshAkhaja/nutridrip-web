import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Consultation, HealthQuiz, User } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { notify } from "@/lib/notify";
import { normalisePhone } from "@/lib/auth/phone";
import { approvalState } from "@/lib/clinical/validity";
import { DRIP_AFTER_CALL_MIN, callProblem, callWhen, earliestDrip } from "@/lib/clinical/calls";
import { bookedCalls, ensureCallIndexes, hoursOf } from "@/lib/data/calls";
import { createWithReference, nextReference } from "@/lib/sequence";
import { ok, fail, handleError } from "@/lib/api";
import { getClockFormat } from "@/lib/settings/clock";
import { clockText } from "@/lib/time";
import { heldDripOf } from "@/lib/data/own-sessions";

export const dynamic = "force-dynamic";

const Book = z.object({
  doctorId: z.string().max(40),
  startAt: z.string().datetime(),
  /** Only when the account has no number on it. */
  phone: z.string().max(20).optional(),
});

/** Which unique rule a duplicate-key error broke, so the patient is told the right thing. */
function duplicateOf(err: unknown): "patient" | "slot" | null {
  const e = err as { code?: number; keyPattern?: Record<string, unknown> };
  if (e?.code !== 11000) return null;
  return e.keyPattern && "patientId" in e.keyPattern ? "patient" : "slot";
}

/** Book a phone call with a physician. Patients only, while their answers wait for an approval. */
export async function POST(req: Request) {
  const clockFmt = await getClockFormat();
  try {
    const session = await getSession();
    if (!can(session?.role, "calls.book")) return fail("Only a patient books a call", 403);
    const input = Book.parse(await req.json());
    await connectDB();

    const quiz = await HealthQuiz.findOne({ patientId: session!.sub })
      .sort({ completedAt: -1 })
      .lean<{ _id: unknown; reviewStatus: string; reviewedAt?: Date; completedAt: Date } | null>();
    const approval = approvalState(quiz);
    // A call is for answers a physician has yet to approve. Approved: book the
    // drip directly. Declined or lapsed: the quiz comes first.
    if (approval.canBook) return fail("You are approved already — book your drip directly.", 409);
    if (!approval.canHold) return fail(approval.message, 409);

    const [patient, doctor, hours] = await Promise.all([
      User.findById(session!.sub).select("name phone").lean<{ name: string; phone?: string } | null>(),
      User.findOne({ _id: input.doctorId, role: "doctor", status: "active" })
        .select("name")
        .lean<{ _id: unknown; name: string } | null>(),
      hoursOf(input.doctorId),
    ]);
    if (!doctor || !hours || hours.weekly.length === 0) return fail("That physician is not taking calls", 422);

    const phone = patient?.phone ?? normalisePhone(input.phone);
    if (!phone) return fail("Add the phone number the physician should call", 422);

    const at = new Date(input.startAt);
    const booked = await bookedCalls(
      input.doctorId,
      new Date(at.getTime() - 86_400_000),
      new Date(at.getTime() + 86_400_000)
    );
    const problem = callProblem(hours, booked, at);
    if (problem) return fail(clockText(problem.error, clockFmt), problem.status);

    // A drip still held (from a call that was cancelled or missed) waits for
    // this one, so the call has to end 2 hours before it.
    const held = await heldDripOf(session!.sub);
    if (held && earliestDrip(at.getTime(), hours.callMinutes) > new Date(held.scheduledAt).getTime()) {
      const latest = new Date(held.scheduledAt).getTime() - (hours.callMinutes + DRIP_AFTER_CALL_MIN) * 60_000;
      return fail(
        `Your held drip ${held.bookingNo} is on ${callWhen(held.scheduledAt, clockFmt)}, and the call has to end 2 hours before it. Pick a call by ${callWhen(new Date(latest), clockFmt)}, or move the drip from Home first.`,
        422
      );
    }

    await ensureCallIndexes();
    let call;
    try {
      call = await createWithReference(
        (callNo) =>
          Consultation.create({
            callNo,
            patientId: session!.sub,
            doctorId: input.doctorId,
            quizId: quiz?._id,
            startAt: at,
            minutes: hours.callMinutes,
            phone,
          }),
        (attempt) =>
          nextReference(
            Consultation,
            "callNo",
            (n) => `CL-${5000 + n}`,
            (ref) => Number(ref.split("-")[1] ?? 0) - 5000,
            attempt
          )
      );
    } catch (err) {
      // The database refused a second booked call: for this patient, or for this physician at this time.
      const dup = duplicateOf(err);
      if (dup === "patient")
        return fail("You already have a call booked. Move it on Home if the time does not suit.", 409);
      if (dup === "slot") return fail("That call time was just taken. Pick another.", 409);
      throw err;
    }

    await notify(
      input.doctorId,
      `New call booked · ${call.callNo}`,
      `${patient?.name ?? "A patient"} · ${callWhen(at, clockFmt)}. Their answers are in your queue.`,
      "info",
      "/doctor/calls"
    );
    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "call.book",
      entity: "Consultation",
      entityId: String(call._id),
      after: { callNo: call.callNo, doctor: doctor.name, startAt: at, minutes: hours.callMinutes },
    });

    return ok(
      { call: { id: String(call._id), callNo: call.callNo, startAt: at.toISOString(), minutes: hours.callMinutes } },
      { status: 201 }
    );
  } catch (err) {
    return handleError(err);
  }
}

/** Calls for the staff screens: a physician sees their own, the super admin and ops admin see all. */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (session?.role === "patient") {
      await connectDB();
      const mine = await Consultation.find({ patientId: session.sub }).sort({ startAt: -1 }).lean();
      return ok({ calls: mine });
    }
    if (!can(session?.role, "calls.view")) return fail("Not permitted", 403);
    await connectDB();
    const params = new URL(req.url).searchParams;
    const from = params.get("from") ? new Date(params.get("from")!) : new Date(Date.now() - 86_400_000);
    const to = params.get("to") ? new Date(params.get("to")!) : new Date(Date.now() + 8 * 86_400_000);
    const calls = await Consultation.find({
      ...(session!.role === "doctor" ? { doctorId: session!.sub } : {}),
      startAt: { $gte: from, $lte: to },
    })
      // Bounded by the date window, not a silent row cap.
      .sort({ startAt: 1 })
      .lean();
    return ok({ calls });
  } catch (err) {
    return handleError(err);
  }
}
