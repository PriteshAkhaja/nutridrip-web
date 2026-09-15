import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Booking, Drip, HealthQuiz, User } from "@/lib/models";
import { notify } from "@/lib/notify";
import { pickNurse } from "@/lib/clinical/assign";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { ok, fail, handleError } from "@/lib/api";

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
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "quiz.decide")) {
      return fail("Approving a protocol is a prescribing decision — only a physician can make it", 403);
    }

    const { id } = await params;
    const { decision, notes, nurseId, patientNote, dripIds, strength, infoRequest, declineReason } =
      Input.parse(await req.json());
    await connectDB();

    const quiz = await HealthQuiz.findById(id);
    if (!quiz) return fail("Quiz not found", 404);
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
    await quiz.save();

    // The decision releases or blocks any booking the patient is waiting on.
    const waiting = await Booking.find({ patientId: quiz.patientId, status: "awaiting_review" });
    const patient = await User.findById(quiz.patientId).lean<{
      name: string;
      patient?: { latitude?: number; longitude?: number; pincode?: string };
    } | null>();

    const assigned: Array<{
      bookingNo: string;
      nurseId: string;
      nurseName: string;
      km: number;
      /** The physician asked for somebody who could not take it. */
      overridden: boolean;
      requestedNurseName: string | null;
    }> = [];

    for (const booking of waiting) {
      /**
       * A question is not a decision. The booking stays exactly where it is —
       * awaiting_review — so the slot is still held while the patient answers.
       * Declining for a missing detail cancelled it and made them start again.
       */
      if (decision === "info_needed") continue;

      if (decision === "rejected") {
        booking.status = "rejected";
        booking.doctorId = session!.sub;
        booking.rejectionReason = notes;
        await booking.save();
        continue;
      }

      booking.status = "approved";
      booking.doctorId = session!.sub;
      booking.approvedAt = new Date();
      booking.approvalNotes = notes;

      // An approval that reaches nobody is not an approval. Dispatch the
      // nearest nurse under capacity so the session actually has an owner.
      // The physician's choice wins over whoever was already pencilled in.
      const pick = await pickNurse(
        {
          latitude: patient?.patient?.latitude,
          longitude: patient?.patient?.longitude,
          pincode: patient?.patient?.pincode,
        },
        { requestedNurseId: nurseId || (booking.nurseId ? String(booking.nurseId) : null) }
      );

      if (pick) {
        booking.nurseId = pick.nurseId;
        booking.status = "nurse_assigned";
        assigned.push({
          bookingNo: booking.bookingNo,
          nurseId: pick.nurseId,
          nurseName: pick.name,
          km: pick.distanceKm,
          overridden: pick.overridden,
          requestedNurseName: pick.requestedNurseName,
        });
      }
      await booking.save();
    }

    /* ---- Tell everyone who now has something to do ---- */
    const patientName = patient?.name ?? "the patient";

    /**
     * Every outcome now carries the physician's own words to the patient.
     * "Approved with changes" used to arrive as "You can book a session now",
     * which told them nothing had changed when something had.
     */
    if (decision === "rejected") {
      await notify(
        String(quiz.patientId),
        "A physician reviewed your assessment",
        [declineReason?.trim(), patientNote?.trim()].filter(Boolean).join(" — ") ||
          "IV therapy is not suitable for you right now. Tap to read why.",
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
      await notify(
        String(quiz.patientId),
        changed ? "Your protocol was approved with changes" : "Your protocol was approved",
        patientNote?.trim() ||
          (changed
            ? `${recommended.map((d) => d.name).join(" and ") || "A different protocol"} is what your physician recommends. Tap to read why.`
            : assigned.length
              ? `${assigned[0].nurseName} will attend your session.`
              : "You can book a session now."),
        "success",
        `/app/results/${id}`
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
        strength,
        recommended: recommended.map((d) => d.name),
        infoRequest,
        nurseId: nurseId || null,
        assigned: assigned.map((a) => a.nurseName),
      },
    });

    return ok({ quizId: id, decision, assigned });
  } catch (err) {
    return handleError(err);
  }
}
