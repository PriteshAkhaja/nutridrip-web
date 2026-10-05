import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Booking, Consultation, Drip, HealthQuiz, User } from "@/lib/models";
import { notify, notifyRole } from "@/lib/notify";
import { pickNurse } from "@/lib/clinical/assign";
import { withScheduleLock } from "@/lib/booking/schedule-lock";
import { saveUnlessChanged } from "@/lib/db/guarded";
import { getClockFormat } from "@/lib/settings/clock";
import { shortDateClock } from "@/lib/time";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { ok, fail, handleError } from "@/lib/api";
import { syncBookingMoney } from "@/lib/payments/money";
import { inr } from "@/lib/billing/late-policy";

const Input = z.object({
  decision: z.enum(["approved", "modified", "rejected", "info_needed"]),
  /** For the nurse: rate, additives, anything to do at the chair. */
  notes: z.string().max(4000).optional(),
  /** For the patient, in plain words: what was changed and why. */
  patientNote: z.string().max(4000).optional(),
  /** What the physician recommends, which may differ from the quiz. */
  dripIds: z.array(z.string().max(40)).max(10).optional(),
  strength: z.enum(["strong", "recommended", "optional"]).nullable().optional(),
  /** The one question that must be answered before a decision can be made. */
  infoRequest: z.string().max(1000).optional(),
  /** Why it was declined, from the physician's list. The patient is shown it. */
  declineReason: z.string().max(200).optional(),
  /**
   * The nurse the physician chose. Omitted means "whoever dispatch would have
   * picked", which is what this route did before there was a choice at all —
   * so an approval is never blocked by the physician's own team being busy.
   */
  nurseId: z.string().max(40).nullable().optional(),
  /**
   * Approving a different drip from the one the patient held: switch the held
   * session to this drip, so what is booked is what was approved.
   */
  switchHeldTo: z.string().max(40).nullable().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "quiz.decide")) {
      return fail("Approving a protocol is a prescribing decision — only a physician can make it", 403);
    }

    const { id } = await params;
    const { decision, notes, nurseId, patientNote, dripIds, strength, infoRequest, declineReason, switchHeldTo } =
      Input.parse(await req.json());
    await connectDB();

    const quiz = await HealthQuiz.findById(id);
    if (!quiz) return fail("Quiz not found", 404);
    if (quiz.reviewStatus === "superseded") {
      return fail(
        "The patient answered the quiz again, so these answers were replaced. Review the newer submission.",
        409
      );
    }
    if (quiz.reviewStatus !== "pending") return fail("This submission has already been reviewed", 409);

    /**
     * The nurse is checked BEFORE the quiz is marked reviewed.
     *
     * Validating afterwards meant a mistyped nurse returned 422 while the quiz
     * was already saved as approved — so the physician saw an error, nothing
     * was dispatched, and trying again returned "already reviewed". The
     * decision must not be recorded until everything it depends on is known
     * good.
     */
    if (nurseId) {
      const nurse = await User.findById(nurseId).lean<{ role: string; status: string; name: string } | null>();
      if (!nurse || nurse.role !== "nurse") return fail("That is not a nurse account", 422);
      if (nurse.status !== "active") return fail(`${nurse.name} is not an active account`, 409);
    }

    // Asking for something without saying what would reach the patient as a
    // held booking and no question.
    if (decision === "info_needed" && !infoRequest?.trim()) {
      return fail("Say what you need from the patient, or they cannot answer it", 422);
    }

    // Checked before anything is saved, for the same reason as the nurse: a
    // drip that is not a drip is the physician's slip, not a silent no-op.
    let recommended: Array<{ _id: unknown; name: string }> = [];
    if (dripIds?.length) {
      recommended = await Drip.find({ _id: { $in: dripIds }, isActive: true }).lean<
        Array<{ _id: unknown; name: string }>
      >();
      if (recommended.length !== dripIds.length) {
        return fail("One of those drips no longer exists or has been retired", 422);
      }
    }

    let switchTo: { _id: unknown; name: string; priceInr: number; durationMin: number } | null = null;
    if (switchHeldTo && (decision === "approved" || decision === "modified")) {
      switchTo = await Drip.findOne({ _id: switchHeldTo, isActive: true })
        .select("name priceInr durationMin")
        .lean<{ _id: unknown; name: string; priceInr: number; durationMin: number } | null>();
      if (!switchTo) return fail("The drip to switch the held session to no longer exists", 422);
    }

    quiz.reviewStatus = decision;
    quiz.reviewedBy = session!.sub;
    quiz.reviewedAt = new Date();
    quiz.doctorNotes = notes;
    quiz.patientNote = patientNote?.trim() || undefined;
    quiz.declineReason = decision === "rejected" ? declineReason?.trim() || undefined : undefined;
    // The quiz's own suggestion is never overwritten, so "what the physician
    // changed" stays answerable after the fact.
    if (dripIds) quiz.recommendedDripIds = dripIds;
    if (strength !== undefined) quiz.recommendationStrength = strength;
    if (decision === "info_needed") {
      quiz.infoRequest = infoRequest?.trim();
      // A re-ask clears the previous answer, so the two never sit side by side
      // looking like the question was already dealt with.
      quiz.infoAnswer = undefined;
      quiz.infoAnsweredAt = undefined;
    }
    // Claimed on the status that was read: two physicians deciding the same
    // answers at once cannot both win. One approving as the other declines
    // would leave the sessions -- and the refunds -- following whichever
    // landed last.
    quiz.$where = { reviewStatus: "pending" };
    if (!(await saveUnlessChanged(quiz))) return fail("This submission has already been reviewed", 409);

    // The decision releases or blocks any booking the patient is waiting on.
    const waiting = await Booking.find({ patientId: quiz.patientId, status: "awaiting_review" });
    const patient = await User.findById(quiz.patientId).lean<{
      name: string;
      patient?: { latitude?: number; longitude?: number; pincode?: string };
    } | null>();

    // The patient's call with a physician has served its purpose once a decision
    // is made -- whether or not it was marked, and even if it was still ahead.
    // A question to the patient keeps a call that has not happened yet.
    await Consultation.updateMany(
      {
        patientId: quiz.patientId,
        status: "booked",
        ...(decision === "info_needed" ? { startAt: { $lte: new Date(Date.now() + 15 * 60_000) } } : {}),
      },
      { $set: { status: "done", outcomeAt: new Date(), outcomeBy: session!.sub, outcomeNote: `Decided: ${decision}` } }
    );

    const switched: string[] = [];
    const lapsed: string[] = [];
    /** Sessions whose money changes with this decision: refunds, or a balance to pay. */
    const moneyToSettle: string[] = [];

    const assigned: Array<{
      bookingNo: string;
      nurseId: string;
      nurseName: string;
      km: number;
      /** The physician asked for somebody who could not take it. */
      overridden: boolean;
      requestedNurseName: string | null;
    }> = [];
    /** Approved, but nobody under their session limit was free then: a person assigns one. */
    const unstaffed: Array<{ bookingNo: string; scheduledAt: Date }> = [];

    for (const booking of waiting) {
      /**
       * A question is not a decision. The booking stays exactly where it is —
       * awaiting_review — so the slot is still held while the patient answers.
       * Declining for a missing detail cancelled it and made them start again.
       */
      if (decision === "info_needed") continue;

      // A session the patient cancelled a moment ago stays cancelled: each save
      // below lands only on the status that was read.
      if (decision === "rejected") {
        booking.status = "rejected";
        booking.doctorId = session!.sub;
        booking.rejectionReason = notes;
        if (!(await saveUnlessChanged(booking))) continue;
        moneyToSettle.push(String(booking._id));
        continue;
      }

      // Approved after the held time had passed: nothing to send a nurse to.
      // The patient picks a new time, now without waiting.
      if (booking.scheduledAt.getTime() < Date.now()) {
        booking.status = "cancelled";
        booking.cancelledAt = new Date();
        booking.cancelReason = "Its time passed before the approval. Book a new time.";
        booking.cancelledByRole = "system";
        if (!(await saveUnlessChanged(booking))) continue;
        lapsed.push(booking.bookingNo);
        moneyToSettle.push(String(booking._id));
        continue;
      }

      // Confirmed and given a nurse in one step no booking, move or other
      // approval can interleave with (see schedule-lock), on the session read
      // again inside it -- so the nurse chosen here cannot be handed the same
      // time by anyone else, and a session cancelled meanwhile is left alone.
      const done = await withScheduleLock(async (tx) => {
        const b = await Booking.findById(booking._id).session(tx);
        if (!b || b.status !== "awaiting_review") return null;

        let switchedNow = false;
        if (switchTo && String(b.dripId) !== String(switchTo._id)) {
          b.dripId = switchTo._id;
          b.dripName = switchTo.name;
          b.durationMin = switchTo.durationMin;
          b.amount = switchTo.priceInr;
          switchedNow = true;
        }

        b.status = "approved";
        b.doctorId = session!.sub;
        b.approvedAt = new Date();
        b.approvalNotes = notes;

        // An approval that reaches nobody is not an approval. Dispatch the
        // nearest nurse under capacity so the session actually has an owner.
        // The physician's choice wins over whoever was already pencilled in.
        const pick = await pickNurse(
          {
            latitude: patient?.patient?.latitude,
            longitude: patient?.patient?.longitude,
            pincode: patient?.patient?.pincode,
          },
          {
            requestedNurseId: nurseId || (b.nurseId ? String(b.nurseId) : null),
            // Nobody busy at the session's own time, the requested nurse included.
            session: {
              start: b.scheduledAt,
              durationMin: b.durationMin ?? 45,
              bookingId: String(b._id),
            },
          }
        );
        if (pick) {
          b.nurseId = pick.nurseId;
          b.status = "nurse_assigned";
        }
        await b.save();
        return { bookingNo: b.bookingNo as string, scheduledAt: b.scheduledAt as Date, switchedNow, pick };
      });
      if (!done) continue;

      if (done.switchedNow) {
        switched.push(done.bookingNo);
        // Cheaper: the difference goes back. Dearer: it becomes a balance to pay.
        moneyToSettle.push(String(booking._id));
      }
      if (done.pick) {
        assigned.push({
          bookingNo: done.bookingNo,
          nurseId: done.pick.nurseId,
          nurseName: done.pick.name,
          km: done.pick.distanceKm,
          overridden: done.pick.overridden,
          requestedNurseName: done.pick.requestedNurseName,
        });
      } else {
        unstaffed.push({ bookingNo: done.bookingNo, scheduledAt: done.scheduledAt });
      }
    }

    /**
     * A decline also stops sessions already confirmed under an EARLIER approval.
     *
     * A patient who was approved, booked, and then answered the quiz again may
     * have told the physician something new -- a pregnancy, a new medication.
     * Declining those answers used to release only bookings still waiting for
     * review, so a session confirmed last week would still go ahead. One that
     * has started is left to the nurse at the chair.
     */
    const calledOff: Array<{ bookingNo: string; nurseId: string | null; when: Date }> = [];
    if (decision === "rejected") {
      const confirmed = await Booking.find({
        patientId: quiz.patientId,
        status: { $in: ["approved", "nurse_assigned", "en_route"] },
      });
      for (const booking of confirmed) {
        booking.status = "rejected";
        booking.rejectionReason =
          declineReason?.trim() || notes || "The physician declined the patient's latest answers.";
        // Started or ended a moment ago: that is the nurse's, or already settled.
        if (!(await saveUnlessChanged(booking))) continue;
        moneyToSettle.push(String(booking._id));
        calledOff.push({
          bookingNo: booking.bookingNo,
          nurseId: booking.nurseId ? String(booking.nurseId) : null,
          when: booking.scheduledAt,
        });
      }
    }

    /* ---- The money follows the decision ----
       Declined or lapsed: refunded in full. Switched to a cheaper drip: the
       difference goes back. Switched to a dearer one: the difference is a
       balance the patient pays before the session. */
    for (const bookingId of moneyToSettle) {
      const res = await syncBookingMoney(bookingId, { byId: session!.sub }).catch((err) => {
        console.error("[review] money:", err);
        return null;
      });
      if (res?.status === "balance_due") {
        const b = await Booking.findById(bookingId)
          .select("bookingNo amount paidAmount dripName")
          .lean<{ bookingNo: string; amount?: number; paidAmount?: number; dripName?: string } | null>();
        if (b) {
          await notify(
            String(quiz.patientId),
            `${inr(Math.max(0, (b.amount ?? 0) - (b.paidAmount ?? 0)))} to pay before your session · ${b.bookingNo}`,
            `Your physician switched you to ${b.dripName ?? "a different drip"}, which costs more. Pay the difference from Sessions before the nurse arrives.`,
            "warning",
            "/app/sessions"
          );
        }
      }
    }

    /* ---- Tell everyone who now has something to do ---- */
    const patientName = patient?.name ?? "the patient";

    // The nurse has these on their route; they need to know they are off.
    for (const c of calledOff) {
      await notify(
        c.nurseId,
        `Session called off · ${c.bookingNo}`,
        `A physician declined ${patientName}'s latest answers, so this session will not go ahead.`,
        "warning",
        "/nurse"
      );
    }

    /**
     * Every outcome now carries the physician's own words to the patient.
     * "Approved with changes" used to arrive as "You can book a session now",
     * which told them nothing had changed when something had.
     */
    if (decision === "rejected") {
      await notify(
        String(quiz.patientId),
        "A physician reviewed your assessment",
        [
          declineReason?.trim(),
          patientNote?.trim(),
          calledOff.length
            ? `${calledOff.length === 1 ? `Your session ${calledOff[0].bookingNo} will` : `Your ${calledOff.length} booked sessions will`} not go ahead.`
            : undefined,
        ]
          .filter(Boolean)
          .join(" — ") || "IV therapy is not suitable for you right now. Tap to read why.",
        "warning",
        `/app/results/${id}`
      );
    } else if (decision === "info_needed") {
      await notify(
        String(quiz.patientId),
        "Your physician needs one more thing",
        infoRequest!.trim(),
        "info",
        `/app/results/${id}`
      );
    } else {
      const changed = decision === "modified";
      const extra = [
        switched.length && switchTo ? `Your held session ${switched.join(", ")} is now ${switchTo.name}.` : "",
        lapsed.length ? `The time of ${lapsed.join(", ")} had passed, so pick a new time.` : "",
      ]
        .filter(Boolean)
        .join(" ");
      await notify(
        String(quiz.patientId),
        changed ? "Your protocol was approved with changes" : "Your protocol was approved",
        [
          patientNote?.trim() ||
            (changed
              ? `${recommended.map((d) => d.name).join(" and ") || "A different protocol"} is what your physician recommends. Tap to read why.`
              : assigned.length
                ? `${assigned[0].nurseName} will attend your session.`
                : "You can book a session now."),
          extra,
        ]
          .filter(Boolean)
          .join(" "),
        "success",
        `/app/results/${id}`
      );
    }

    const clockFmt = unstaffed.length ? await getClockFormat() : null;
    for (const u of unstaffed) {
      await notifyRole(
        ["admin", "superadmin"],
        `Session needs a nurse · ${u.bookingNo}`,
        `${patientName}, approved for ${shortDateClock(u.scheduledAt, clockFmt ?? "12h")}. Nobody under their session limit was free then — assign a nurse from the booking.`,
        "warning",
        "/admin"
      );
    }

    for (const a of assigned) {
      await notify(
        a.nurseId,
        `New session assigned · ${a.bookingNo}`,
        `${patientName}${a.km ? ` · ${a.km} km away` : ""}. The checklist is ready.`,
        "info",
        "/nurse"
      );

      // Never swap silently: the physician asked for that nurse for a reason.
      if (a.overridden) {
        await notify(
          session!.sub,
          `${a.requestedNurseName ?? "The nurse you chose"} could not take ${a.bookingNo}`,
          `${a.nurseName} was dispatched instead. Reassign from the schedule if that is wrong.`,
          "warning",
          "/doctor/schedule"
        );
      }
    }

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: `quiz.${decision}`,
      entity: "HealthQuiz",
      entityId: id,
      after: {
        decision,
        notes,
        patientNote,
        declineReason,
        ...(calledOff.length ? { sessionsCalledOff: calledOff.map((c) => c.bookingNo) } : {}),
        strength,
        recommended: recommended.map((d) => d.name),
        infoRequest,
        nurseId: nurseId || null,
        assigned: assigned.map((a) => a.nurseName),
        ...(switched.length ? { heldSwitchedTo: switchTo?.name, switched } : {}),
        ...(lapsed.length ? { heldLapsed: lapsed } : {}),
      },
    });

    return ok({ quizId: id, decision, assigned });
  } catch (err) {
    return handleError(err);
  }
}
