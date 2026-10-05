import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Booking, HealthQuiz, User } from "@/lib/models";
import { approvalState } from "@/lib/clinical/validity";
import { notify, notifyRole } from "@/lib/notify";
import { MIN_LEAD_MS, busyNurses, dayLoadOf, ownClashMessage, slotProblem } from "@/lib/clinical/slots";
import { slotContext } from "@/lib/clinical/slot-availability";
import { pickNurse } from "@/lib/clinical/assign";
import { getLatePolicy } from "@/lib/billing/settings";
import { lateFee } from "@/lib/billing/late-policy";
import { openCallFor } from "@/lib/data/calls";
import { callWhen, earliestDrip } from "@/lib/clinical/calls";
import { getClockFormat } from "@/lib/settings/clock";
import { clockText, shortDateClock } from "@/lib/time";
import { patientClash } from "@/lib/data/own-sessions";
import { inr } from "@/lib/billing/late-policy";
import { isRefusal, withScheduleLock, type Refusal } from "./schedule-lock";

/**
 * A slot can be moved, but not indefinitely. Past this the session is holding
 * stock and a nurse's route slot without ever happening, and the clinical team
 * should be looking at it rather than the patient shuffling it again.
 */
export const MAX_RESCHEDULES = 3;

type Actor = { sub: string; role: string };

/* A Mongoose booking document -- only the fields a move reads and writes. */
type MovableBooking = {
  _id: unknown;
  bookingNo: string;
  patientId: unknown;
  nurseId?: unknown;
  dripName?: string;
  status: string;
  scheduledAt: Date;
  durationMin?: number;
  pincode?: string;
  rescheduleCount?: number;
  rescheduledFrom?: Date;
  charges?: Array<Record<string, unknown>>;
  save: () => Promise<unknown>;
};

export type MovePlan = {
  next: Date;
  /** The late fee this move costs the patient; 0 outside the window or for staff. */
  fee: number;
  windowHours: number;
  isOwner: boolean;
  ctx: Awaited<ReturnType<typeof slotContext>>;
};

/**
 * Can this session move to that time, and what does it cost?
 *
 * Every rule, nothing written. When a late move is paid for online this runs
 * before checkout and again when the fee arrives -- and if the time has gone by
 * then, the fee is refunded rather than kept for a move that did not happen.
 */
export async function planMove(
  actor: Actor,
  booking: MovableBooking,
  scheduledAt: Date
): Promise<{ plan: MovePlan } | Refusal> {
  const clockFmt = await getClockFormat();
  await connectDB();
  const id = String(booking._id);
  const isOwner = actor.role === "patient" && String(booking.patientId) === actor.sub;

  if (["completed", "in_progress", "cancelled", "rejected"].includes(booking.status)) {
    return { error: "That session can no longer be moved", status: 409 };
  }

  // Inside the late window a patient may still move the session -- the nurse
  // is already dispatched with the batch drawn, so it costs the late fee.
  // Staff moving a session are never charged to the patient. A slot already in
  // the past is the deepest part of the window, not outside it.
  const policy = await getLatePolicy();
  const hoursOut = (booking.scheduledAt.getTime() - Date.now()) / 3_600_000;
  const fee = isOwner ? lateFee(policy, hoursOut, "late_reschedule") : 0;

  const next = scheduledAt;
  if (next.getTime() - Date.now() < MIN_LEAD_MS) return { error: "Pick a slot at least an hour from now", status: 422 };

  // Only a time the zone offers, with a nurse free for it. The session being
  // moved does not count against itself.
  const durationMin = booking.durationMin ?? 45;
  const ctx = await slotContext({ pincode: booking.pincode, from: next, to: next, excludeBookingId: id });
  // Not onto another of the patient's own sessions (asked first: it is the answer that helps).
  const clash = await patientClash(String(booking.patientId), next, durationMin, id);
  if (clash) return { error: ownClashMessage(clash, clockFmt), status: 409 };
  const slot = slotProblem(ctx, next, durationMin);
  if (slot) return { error: clockText(slot.error, clockFmt), status: slot.status };
  // A drip still held for the physician stays 2 hours after the patient's call.
  if (booking.status === "awaiting_review") {
    const call = await openCallFor(String(booking.patientId));
    const from = call ? earliestDrip(new Date(call.startAt).getTime(), call.minutes) : 0;
    if (next.getTime() < from) {
      return {
        error: `A held drip must be at least 2 hours after your call — from ${callWhen(new Date(from), clockFmt)}.`,
        status: 422,
      };
    }
  }

  if ((booking.rescheduleCount ?? 0) >= MAX_RESCHEDULES) {
    return {
      error: `This session has already been moved ${MAX_RESCHEDULES} times. Cancel it and book again, or call us and we will sort it out.`,
      status: 409,
    };
  }

  // The physician's approval covers the patient as they were when it was
  // given. If it has lapsed, a later slot is a new clinical decision — so it
  // needs a fresh review rather than a drag on the calendar.
  if (isOwner) {
    const quiz = await HealthQuiz.findOne({ patientId: booking.patientId })
      .sort({ completedAt: -1 })
      .lean<{ reviewStatus: string; reviewedAt?: Date; completedAt: Date } | null>();
    const approval = approvalState(quiz);
    if (!approval.canBook && !approval.canHold) {
      return { error: approval.message, status: 409 };
    }
  }

  return { plan: { next, fee, windowHours: policy.windowHours, isOwner, ctx } };
}

/** What a move did, for the words afterwards. */
type Moved = {
  bookingId: string;
  bookingNo: string;
  patientId: string;
  dripName: string | null;
  previous: Date;
  next: Date;
  fee: number;
  rescheduleCount: number;
  previousNurseId: string | null;
  nurseId: string | null;
  handedTo: { nurseId: string; name: string } | null;
  /** Why the nurse on it could not keep it: busy at the new time, or that day already full. */
  handOnReason: "busy" | "full" | null;
  isOwner: boolean;
  paidOnline: boolean;
};

/**
 * Move it, as one step no other booking, move or approval can interleave with
 * (see schedule-lock): every rule checked again on the session as it stands
 * now, the new time, the fee, a nurse free then -- and afterwards a word to
 * everyone whose day it changes.
 *
 * `acceptedFee` is the fee the person was shown and agreed to. The late window
 * can open between that prompt and the press, and a move that now costs more
 * is refused with the new fee rather than charged without asking. `paidFee` is
 * the fee paid online: the charge is recorded as paid, with the payment, and a
 * second delivery of the same payment finds the move already made.
 */
export async function moveSlot(
  actor: Actor,
  bookingId: string,
  scheduledAt: Date,
  opts: { acceptedFee: number; paidFee?: { paymentId: string; amount: number } }
): Promise<{ scheduledAt: Date; rescheduleCount: number; fee: number; already?: boolean } | Refusal> {
  const paidId = opts.paidFee?.paymentId;
  type Out = Refusal | { already: true; scheduledAt: Date; rescheduleCount: number } | { moved: Moved };
  const out = await withScheduleLock(async (session): Promise<Out> => {
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) return { error: "Session not found", status: 404 };
    const charges = (booking.charges ?? []) as Array<{ paymentId?: unknown }>;
    if (paidId && charges.some((c) => String(c.paymentId ?? "") === paidId)) {
      return {
        already: true,
        scheduledAt: booking.scheduledAt,
        rescheduleCount: booking.rescheduleCount ?? 0,
      };
    }

    const planned = await planMove(actor, booking, scheduledAt);
    if ("error" in planned) return planned;
    const { plan } = planned;
    if (!opts.paidFee && plan.fee > opts.acceptedFee) {
      return {
        error: `Your slot is now less than ${plan.windowHours} hours away, so moving it costs ${inr(plan.fee)}.`,
        status: 409,
        extra: { fee: plan.fee, windowHours: plan.windowHours },
      };
    }
    return { moved: await applyMove(actor, booking, plan, opts.paidFee) };
  });

  if (isRefusal(out)) return out;
  if ("already" in out) {
    return { scheduledAt: out.scheduledAt, rescheduleCount: out.rescheduleCount, fee: 0, already: true };
  }
  await announceMove(actor, out.moved);
  return { scheduledAt: out.moved.next, rescheduleCount: out.moved.rescheduleCount, fee: out.moved.fee };
}

/**
 * The move itself, on a booking read inside the lock: the new time, the fee
 * (owed, or paid online) and a nurse who is free then, saved in the lock's
 * transaction. It tells nobody; announceMove does, once it has committed.
 */
async function applyMove(
  actor: Actor,
  booking: MovableBooking,
  plan: MovePlan,
  paidFee?: { paymentId: string; amount: number }
): Promise<Moved> {
  const clockFmt = await getClockFormat();
  const id = String(booking._id);
  const { next, isOwner, ctx } = plan;
  // Paid online: the fee is what was paid (it was the fee when checkout opened).
  const fee = paidFee ? paidFee.amount : plan.fee;
  const durationMin = booking.durationMin ?? 45;

  const previous = booking.scheduledAt;
  const at = (d: Date) => shortDateClock(d, clockFmt);
  booking.rescheduledFrom = previous;
  booking.scheduledAt = next;
  booking.rescheduleCount = (booking.rescheduleCount ?? 0) + 1;
  if (fee > 0) {
    booking.charges = [
      ...(booking.charges ?? []),
      {
        kind: "late_reschedule",
        amount: fee,
        at: new Date(),
        byId: actor.sub,
        note: `Moved from ${at(previous)} to ${at(next)}`,
        ...(paidFee
          ? {
              settledAs: "paid",
              settledAt: new Date(),
              settledById: actor.sub,
              paidMethod: "online",
              paymentId: paidFee.paymentId,
            }
          : {}),
      },
    ];
  }
  // The nurse already on it may be busy at the new time. Then it goes to one
  // who is free — the slot was only offered because somebody was.
  const previousNurseId = booking.nurseId ? String(booking.nurseId) : null;
  let handedTo: { nurseId: string; name: string } | null = null;
  // ...or free then, but moving onto a day they already have their most sessions for.
  const handOnReason: Moved["handOnReason"] = !previousNurseId
    ? null
    : busyNurses(ctx.held, next.getTime(), durationMin).has(previousNurseId)
      ? "busy"
      : ctx.dayLimit != null && dayLoadOf(ctx, previousNurseId, next.getTime()) >= ctx.dayLimit
        ? "full"
        : null;
  if (previousNurseId && handOnReason) {
    const patient = await User.findById(booking.patientId)
      .select("patient.latitude patient.longitude")
      .lean<{ patient?: { latitude?: number; longitude?: number } } | null>();
    const pick = await pickNurse(
      { latitude: patient?.patient?.latitude, longitude: patient?.patient?.longitude, pincode: booking.pincode },
      { excludeNurseId: previousNurseId, session: { start: next, durationMin, bookingId: id } }
    );
    if (pick) {
      booking.nurseId = pick.nurseId;
      handedTo = { nurseId: pick.nurseId, name: pick.name };
    } else {
      booking.nurseId = undefined;
    }
    if (["nurse_assigned", "en_route"].includes(booking.status)) booking.status = pick ? "nurse_assigned" : "approved";
  }
  await booking.save();

  return {
    bookingId: id,
    bookingNo: booking.bookingNo,
    patientId: String(booking.patientId),
    dripName: booking.dripName ?? null,
    previous,
    next,
    fee,
    rescheduleCount: booking.rescheduleCount ?? 0,
    previousNurseId,
    nurseId: booking.nurseId ? String(booking.nurseId) : null,
    handedTo,
    handOnReason,
    isOwner,
    paidOnline: Boolean(paidFee),
  };
}

/** A word to everyone whose day the move changes, and the audit row. Once it has committed. */
async function announceMove(actor: Actor, m: Moved) {
  const clockFmt = await getClockFormat();
  const at = (d: Date) => shortDateClock(d, clockFmt);
  const when = at(m.next);
  const handedOn = Boolean(m.previousNurseId) && (m.nurseId ?? "") !== m.previousNurseId;
  if (m.previousNurseId && handedOn) {
    await notify(
      m.previousNurseId,
      `Session handed on · ${m.bookingNo}`,
      `It moved to ${when}, ${m.handOnReason === "full" ? "a day you are already fully booked" : "when you already have a session"}. ${m.handedTo ? `${m.handedTo.name} is taking it.` : "The team is finding a nurse."} It is off your route.`,
      "info",
      "/nurse/schedule"
    );
    if (m.handedTo) {
      await notify(
        m.handedTo.nurseId,
        `New session assigned · ${m.bookingNo}`,
        `${m.dripName ?? "Session"} · ${when}`,
        "info",
        "/nurse"
      );
    } else {
      await notifyRole(
        ["admin", "superadmin"],
        `Session needs a nurse · ${m.bookingNo}`,
        `Moved to ${when}; nobody free was found.`,
        "warning",
        "/admin"
      );
    }
  }
  await notify(
    m.nurseId,
    m.fee > 0 ? `Session moved at the last moment · ${m.bookingNo}` : `Session moved · ${m.bookingNo}`,
    m.fee > 0
      ? `Was ${at(m.previous)}, now ${when}. The patient moved it inside the late window and was charged the late fee. Your route has been updated.`
      : `Now ${when}. Your route has been updated.`,
    "warning",
    "/nurse/schedule"
  );
  if (!m.isOwner) {
    await notify(m.patientId, `Your session was moved · ${m.bookingNo}`, `Now ${when}.`, "info", "/app/sessions");
  }

  await AuditLog.create({
    actorId: actor.sub,
    actorRole: actor.role,
    action: "booking.reschedule",
    entity: "Booking",
    entityId: m.bookingId,
    before: { scheduledAt: m.previous },
    after: {
      scheduledAt: m.next,
      ...(m.fee > 0 ? { lateFee: m.fee, ...(m.paidOnline ? { lateFeePaidOnline: true } : {}) } : {}),
      ...(handedOn ? { nurseHandedOn: m.handedTo?.name ?? "nobody free" } : {}),
    },
  });
}
