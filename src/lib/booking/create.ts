import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Booking, Drip, HealthQuiz, User } from "@/lib/models";
import { CHECKLIST_STEPS } from "@/lib/clinical/checklist";
import { approvalState } from "@/lib/clinical/validity";
import { checkAvailability } from "@/lib/inventory/availability";
import { LOCATIONS } from "@/lib/models/types";
import { notify, notifyRole } from "@/lib/notify";
import { pickNurse } from "@/lib/clinical/assign";
import { nextReference } from "@/lib/sequence";
import { zoneForPincode } from "@/lib/zones";
import { getZones } from "@/lib/zones-store";
import { MIN_LEAD_MS, ownClashMessage, slotProblem } from "@/lib/clinical/slots";
import { slotContext } from "@/lib/clinical/slot-availability";
import { callGate } from "@/lib/data/calls";
import { callWhen } from "@/lib/clinical/calls";
import { getClockFormat } from "@/lib/settings/clock";
import { clockText, shortDateClock } from "@/lib/time";
import { heldDripOf, patientClash } from "@/lib/data/own-sessions";
import { patientMayBook } from "@/lib/clinical/drip-access";
import { isRefusal, withScheduleLock, type Refusal } from "./schedule-lock";

export type { Refusal } from "./schedule-lock";

export const CreateBooking = z.object({
  dripId: z.string(),
  scheduledAt: z.string().datetime(),
  location: z.enum(LOCATIONS),
  address: z.string().max(300).optional(),
  pincode: z.string().max(10).optional(),
  /** Older clients may still send it; a patient's booking is never at a clinic (below). */
  clinicId: z.string().optional(),
  notes: z.string().max(1000).optional(),
});
export type BookingInput = z.infer<typeof CreateBooking>;

/** Everything decided about a booking before it is written. */
export type BookingPlan = {
  patientId: string;
  input: BookingInput;
  when: Date;
  drip: { _id: unknown; name: string; priceInr: number; durationMin: number };
  clinic: { _id: unknown; name: string; clinic?: { pincode?: string; city?: string } } | null;
  pincode: string | undefined;
  address: string | undefined;
  city: string | undefined;
  patient: { latitude?: number; longitude?: number } | null;
  /** Approved: a confirmed session. Otherwise a slot held for the physician. */
  canBook: boolean;
  doctorId: unknown;
};

/**
 * Can this patient book this, now?
 *
 * Every rule a booking must pass, and nothing written. It runs twice when the
 * patient pays: before checkout opens, so nobody is charged for a booking that
 * could never be made, and again when the money arrives, because the slot may
 * have gone in the minute it took to pay -- and then the payment is refunded.
 */
export async function planBooking(patientId: string, input: BookingInput): Promise<{ plan: BookingPlan } | Refusal> {
  const clockFmt = await getClockFormat();
  await connectDB();

  const drip = await Drip.findById(input.dripId).lean<{
    _id: unknown;
    name: string;
    priceInr: number;
    durationMin: number;
    isActive: boolean;
    isPublic?: boolean;
  } | null>();
  if (!drip || !drip.isActive) return { error: "That drip is no longer available", status: 404 };
  // A drip kept off the website is booked on a physician's recommendation only.
  if (drip.isPublic === false) {
    const latest = await HealthQuiz.findOne({ patientId })
      .sort({ completedAt: -1 })
      .select("recommendedDripIds")
      .lean<{ recommendedDripIds?: unknown[] } | null>();
    if (!patientMayBook(drip, latest?.recommendedDripIds ?? [])) {
      return { error: "That drip is booked on your physician's recommendation only.", status: 403 };
    }
  }

  const when = new Date(input.scheduledAt);
  if (when.getTime() - Date.now() < MIN_LEAD_MS) return { error: "Pick a slot at least an hour from now", status: 422 };
  // Not two sessions of the patient's own at once. Checked before stock and
  // nurses: "you already have a session then" is the answer that helps.
  const clash = await patientClash(patientId, when, drip.durationMin);
  if (clash) return { error: ownClashMessage(clash, clockFmt), status: 409 };

  // A slot is only real if the stock behind it is real — and a booking does
  // not reserve, so the sessions already promised have to be counted too.
  // Without that, ten patients could each pass a check for the same last
  // preparable drip.
  const { results } = await checkAvailability([{ dripId: input.dripId, quantity: 1 }], true);
  const preparable = results[0]?.wholeVialAvailability ?? 0;
  const alreadyPromised = await Booking.countDocuments({
    dripId: drip._id,
    status: { $in: ["awaiting_review", "approved", "nurse_assigned", "en_route", "in_progress"] },
  });

  if (preparable < 1) {
    return {
      error: `${drip.name} cannot be prepared right now${
        results[0]?.bottleneck ? ` — ${results[0].bottleneck.ingredient} is out` : ""
      }`,
      status: 409,
    };
  }
  if (preparable <= alreadyPromised) {
    return {
      error: `${drip.name} is fully committed — every unit we can prepare is already promised to a booked session. Try another drip, or come back once the pharmacy has restocked.`,
      status: 409,
    };
  }

  const patient = await User.findById(patientId).lean<{
    patient?: {
      address?: string;
      city?: string;
      pincode?: string;
      latitude?: number;
      longitude?: number;
    };
  } | null>();

  // Where the nurse goes: an address inside a zone we actually cover. The site
  // promises a straight yes or no on the pincode, so the no is given here
  // rather than by a nurse who cannot come. A patient never books a partner
  // clinic's rooms: clinics are the business's own customers, and their names
  // are not shown to patients.
  if (input.location === "clinic") {
    return { error: "Sessions are given at your home, office or hotel. Choose one of those.", status: 422 };
  }
  const pincode = input.pincode?.replace(/\D/g, "") || patient?.patient?.pincode || undefined;
  if (!pincode) return { error: "Add your pincode so we can check a nurse can reach you", status: 422 };
  const zone = zoneForPincode(pincode, await getZones());
  if (!zone) {
    return {
      error: `We do not serve pincode ${pincode} yet. The zones we cover are listed under Zones.`,
      status: 409,
    };
  }

  // The time must be one the zone offers, with a nurse free for it — the
  // same rule that greyed the others out on the booking screen, applied
  // again here because the screen may be minutes old.
  const slot = slotProblem(await slotContext({ pincode, from: when, to: when }), when, drip.durationMin);
  if (slot) return { error: clockText(slot.error, clockFmt), status: slot.status };

  // A booking is only approved once a physician has read a quiz that is
  // still inside its review window.
  const quiz = await HealthQuiz.findOne({ patientId })
    .sort({ completedAt: -1 })
    .lean<{ reviewStatus: string; reviewedAt?: Date; reviewedBy?: unknown; completedAt: Date } | null>();
  const approval = approvalState(quiz);
  // Undecided -- still being read, or waiting on the patient's answer to a
  // question -- is the one blocked state a patient may hold a slot against.
  if (!approval.canBook && !approval.canHold) {
    return { error: approval.message, status: 409 };
  }
  // Waiting for an approval: the physician calls first, and the drip is held
  // from two hours after the call, so the decision comes before the nurse sets off.
  if (!approval.canBook) {
    const gate = await callGate(patientId, quiz!.completedAt);
    if (!gate.ok) return { error: gate.message, status: 409 };
    if (gate.notBefore && when.getTime() < gate.notBefore) {
      return {
        error: `Your drip must be at least 2 hours after your call — from ${callWhen(new Date(gate.notBefore), clockFmt)}.`,
        status: 422,
      };
    }
    // One held drip per decision: it is the session the approval confirms.
    const held = await heldDripOf(patientId);
    if (held) {
      return {
        error: `You already have ${held.bookingNo}${held.dripName ? ` (${held.dripName})` : ""} held for ${callWhen(held.scheduledAt, clockFmt)}. It is confirmed when your physician approves — move it from Home if the time does not suit.`,
        status: 409,
      };
    }
  }

  return {
    plan: {
      patientId,
      input,
      when,
      drip: { _id: drip._id, name: drip.name, priceInr: drip.priceInr, durationMin: drip.durationMin },
      clinic: null,
      pincode,
      address: input.address ?? patient?.patient?.address,
      city: patient?.patient?.city,
      patient: patient?.patient ?? null,
      canBook: approval.canBook,
      doctorId: approval.canBook && quiz?.reviewedBy ? quiz.reviewedBy : undefined,
    },
  };
}

/** A booking as bookSlot hands it back: the saved row, plain. */
export type BookedSession = {
  _id: unknown;
  bookingNo: string;
  status: string;
  dripName?: string;
  scheduledAt: Date;
  [key: string]: unknown;
};

const duplicateOf = (err: unknown, field: string) =>
  (err as { code?: number })?.code === 11000 &&
  Boolean((err as { keyPattern?: Record<string, unknown> })?.keyPattern?.[field]);

/**
 * Book it: every rule checked again, a nurse chosen and the booking written, as
 * one step that no other booking, move or approval can interleave with (see
 * schedule-lock). Two patients paying for the last free nurse at the same
 * moment are served one after the other, and the second is told the time has
 * gone -- so a paid-for booking is refunded, never left without its nurse.
 *
 * `paid` is the payment that makes it: the booking costs what was paid (the
 * price the patient agreed to at checkout), starts paid, and carries the
 * payment's id, so the same payment confirmed twice -- by the browser and by
 * the webhook -- finds the booking the first one made instead of booking again.
 */
export async function bookSlot(
  patientId: string,
  input: BookingInput,
  actor: { id: string; role: string },
  paid?: { paymentId: string; amountInr: number }
): Promise<{ booking: BookedSession; made: boolean } | Refusal> {
  for (let attempt = 0; ; attempt++) {
    let out;
    try {
      out = await withScheduleLock(async (session) => {
        if (paid) {
          const existing = await Booking.findOne({ createdFromPaymentId: paid.paymentId })
            .session(session)
            .lean<BookedSession | null>();
          if (existing) return { booking: existing, made: false as const };
        }

        const planned = await planBooking(patientId, input);
        if ("error" in planned) return planned;
        const { plan } = planned;
        const { drip, when, clinic, pincode } = plan;

        // Confirmed: the nurse is chosen here, inside the same step, so nobody
        // else can be handed the same nurse for the same time.
        const pick = plan.canBook
          ? await pickNurse(
              { latitude: plan.patient?.latitude, longitude: plan.patient?.longitude, pincode },
              { session: { start: when, durationMin: drip.durationMin } }
            )
          : null;

        const bookingNo = await nextReference(
          Booking,
          "bookingNo",
          (n) => `ND-${4400 + n}`,
          (ref) => Number(ref.split("-")[1] ?? 0) - 4400,
          attempt
        );
        const amount = paid ? paid.amountInr : drip.priceInr;
        const [created] = await Booking.create(
          [
            {
              bookingNo,
              patientId: plan.patientId,
              dripId: drip._id,
              dripName: drip.name,
              scheduledAt: when,
              durationMin: drip.durationMin,
              location: plan.input.location,
              address: plan.address,
              city: plan.city,
              pincode,
              clinicId: clinic?._id,
              // The physician who approved the standing protocol owns this session.
              doctorId: plan.doctorId,
              // Only a physician's yes confirms a booking; anything else is a held slot.
              status: plan.canBook ? (pick ? "nurse_assigned" : "approved") : "awaiting_review",
              approvedAt: plan.canBook ? new Date() : undefined,
              nurseId: pick?.nurseId,
              checklist: CHECKLIST_STEPS.map((s) => ({ ...s })),
              amount,
              paymentStatus: paid ? "paid" : "unpaid",
              paidAmount: paid ? amount : 0,
              ...(paid ? { createdFromPaymentId: paid.paymentId } : {}),
            },
          ],
          { session }
        );
        return { booking: created.toObject() as BookedSession, made: true as const, plan, pick };
      });
    } catch (err) {
      // Another booking holds that reference: the next one along.
      if (attempt < 4 && duplicateOf(err, "bookingNo")) continue;
      throw err;
    }

    if (isRefusal(out)) return out;
    if (out.made) await announceBooking(out.plan, out.booking, out.pick, actor, Boolean(paid));
    return { booking: out.booking, made: out.made };
  }
}

/** Tell everyone who now has something to do. After the booking is written, never inside the lock. */
async function announceBooking(
  plan: BookingPlan,
  booking: BookedSession,
  pick: Awaited<ReturnType<typeof pickNurse>>,
  actor: { id: string; role: string },
  paidOnline: boolean
) {
  const clockFmt = await getClockFormat();
  const { drip, when, clinic } = plan;
  const slotLabel = shortDateClock(when, clockFmt);

  if (booking.status === "awaiting_review") {
    await notifyRole(
      ["doctor"],
      "A slot is held pending your review",
      `${drip.name} · ${slotLabel}`,
      "info",
      "/doctor"
    );
  } else if (pick) {
    await notify(
      pick.nurseId,
      `New session assigned · ${booking.bookingNo}`,
      `${drip.name}${pick.distanceKm ? ` · ${pick.distanceKm} km away` : ""}`,
      "info",
      "/nurse"
    );
  } else {
    // A time can be free while every nurse free then already carries their
    // limit of open sessions. The booking stands -- the patient was offered
    // the time, and may have paid for it -- so a person has to assign one.
    await notifyRole(
      ["admin", "superadmin"],
      `Session needs a nurse · ${booking.bookingNo}`,
      `${drip.name} · ${slotLabel}. Nobody under their session limit was free then — assign a nurse from the booking.`,
      "warning",
      "/admin"
    );
  }

  if (clinic) {
    await notify(
      String(clinic._id),
      `Session booked into your rooms · ${booking.bookingNo}`,
      `${drip.name} · ${slotLabel}`,
      "info",
      "/clinic/bookings"
    );
  }

  await AuditLog.create({
    actorId: actor.id,
    actorRole: actor.role,
    action: "booking.create",
    entity: "Booking",
    entityId: String(booking._id),
    after: {
      bookingNo: booking.bookingNo,
      dripName: booking.dripName,
      scheduledAt: booking.scheduledAt,
      location: plan.input.location,
      ...(pick ? { nurse: pick.name } : plan.canBook ? { nurse: "none free — admins told" } : {}),
      ...(paidOnline ? { paidOnline: true } : {}),
    },
  });
}
