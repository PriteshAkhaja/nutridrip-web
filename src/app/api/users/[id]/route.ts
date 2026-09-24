import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, Booking, User } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { hashPassword } from "@/lib/auth/password";
import { USER_STATUS } from "@/lib/models/types";
import { normalisePhone } from "@/lib/auth/phone";
import { checkGstin } from "@/lib/billing/gst";
import { notify } from "@/lib/notify";
import { noticesForNurseChange } from "@/lib/data/team-notices";
import { trackedFields, withDoctorName } from "@/lib/data/user-audit";
import { ok, fail, handleError } from "@/lib/api";

const UpdateUser = z.object({
  name: z.string().min(1, "enter a name").max(120, "that name is too long").optional(),
  phone: z.string().min(6, "that number does not look right").max(20, "that number does not look right").optional(),
  status: z.enum(USER_STATUS).optional(),
  password: z.string().min(8, "use at least 8 characters").max(72, "use 72 characters or fewer").optional(),
  specialization: z.string().max(120).optional(),
  licenseNo: z.string().max(60).optional(),
  registrationCouncil: z.string().max(120).optional(),
  serviceAreas: z.array(z.string().max(60)).optional(),
  doctorId: z.string().max(40).nullable().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  address: z.string().max(300).optional(),
  city: z.string().max(80).optional(),
  pincode: z.string().max(10).optional(),
  monthlyVolumeTarget: z.number().int().min(0).max(10000).optional(),
  /**
   * A clinic's GST registration.
   *
   * It was accepted when an account was created but silently dropped on every
   * edit afterwards — the field sat on the form, said "Saved", and changed
   * nothing. It is also load-bearing now: its first two digits decide whether
   * that clinic's invoice carries CGST+SGST or IGST.
   */
  gstin: z.string().max(20).optional(),
  /** A clinic on credit is invoiced after dispatch; otherwise it pays for each order first. */
  onCredit: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "users.manage")) return fail("Only a super admin can change accounts", 403);

    const { id } = await params;
    const input = UpdateUser.parse(await req.json());
    // A clinic's GSTIN decides whether their invoice carries CGST+SGST or
    // IGST, so a malformed one is a wrongly taxed bill rather than a cosmetic
    // slip. Checked here as well as on the form, because the form is not the
    // only way in.
    if (input.gstin) {
      const verdict = checkGstin(input.gstin);
      if (verdict.error) return fail(verdict.error, 422);
    }
    await connectDB();

    const user = await User.findById(id);
    if (!user) return fail("Account not found", 404);

    // Deactivating someone mid-session would strand a patient with a nurse who
    // can no longer open the checklist.
    if (input.status && input.status !== "active" && ["nurse", "doctor"].includes(user.role)) {
      const openWork = await Booking.countDocuments({
        [user.role === "nurse" ? "nurseId" : "doctorId"]: id,
        status: { $in: ["nurse_assigned", "en_route", "in_progress"] },
      });
      if (openWork > 0) {
        return fail(
          `${user.name} still has ${openWork} open session${openWork === 1 ? "" : "s"}. Reassign those first.`,
          409
        );
      }
    }

    const before = { name: user.name, status: user.status };
    // Everything an edit can change that is worth a before-and-after: the trail used
    // to keep only the name and status, so a moved nurse or a new GSTIN left no trace.
    const beforeFields = trackedFields(user.toObject());
    let doctorNames: Record<string, string> = {};
    // What the team looked like before this edit, for telling the people it changes for.
    const wasDoctorId = user.role === "nurse" && user.nurse?.doctorId ? String(user.nurse.doctorId) : null;

    if (input.name) user.name = input.name;
    if (input.phone) {
      const phone = normalisePhone(input.phone);
      if (!phone) return fail("That phone number does not look right", 422);
      const taken = await User.exists({ phone, _id: { $ne: id } });
      if (taken) return fail("That phone number already belongs to another account", 409);
      user.phone = phone;
    }
    if (input.status) user.status = input.status;
    if (input.password) user.passwordHash = await hashPassword(input.password);

    /**
     * End every session this account already holds.
     *
     * Two moments call for it, and both were silent before: a new password is
     * usually set because the old one is compromised, and an account that stops
     * being active should stop being usable now rather than whenever its token
     * happens to expire. Raising the number invalidates them all at once —
     * see tokenVersion on the User model.
     */
    const stopsAccess = Boolean(input.password) || (input.status && input.status !== "active");
    if (stopsAccess) user.tokenVersion = (user.tokenVersion ?? 0) + 1;

    if (user.role === "doctor") {
      user.doctor = {
        ...(user.doctor ?? {}),
        ...(input.specialization !== undefined && { specialization: input.specialization }),
        ...(input.licenseNo !== undefined && { licenseNo: input.licenseNo }),
        ...(input.registrationCouncil !== undefined && { registrationCouncil: input.registrationCouncil }),
      };
    }
    if (user.role === "nurse") {
      if (input.doctorId) {
        const doctor = await User.findById(input.doctorId).lean<{ role: string } | null>();
        if (!doctor || doctor.role !== "doctor") return fail("That is not a physician account", 422);
      }
      user.nurse = {
        ...(user.nurse ?? {}),
        // null clears the link; undefined leaves it alone.
        ...(input.doctorId !== undefined && { doctorId: input.doctorId || undefined }),
        ...(input.licenseNo !== undefined && { licenseNo: input.licenseNo }),
        ...(input.serviceAreas !== undefined && { serviceAreas: input.serviceAreas }),
        ...(input.latitude !== undefined && { latitude: input.latitude }),
        ...(input.longitude !== undefined && { longitude: input.longitude }),
      };
    }
    if (user.role === "clinic") {
      user.clinic = {
        ...(user.clinic ?? {}),
        ...(input.address !== undefined && { address: input.address }),
        ...(input.city !== undefined && { city: input.city }),
        ...(input.pincode !== undefined && { pincode: input.pincode }),
        ...(input.monthlyVolumeTarget !== undefined && { monthlyVolumeTarget: input.monthlyVolumeTarget }),
        ...(input.gstin !== undefined && { gstin: input.gstin }),
        ...(input.onCredit !== undefined && { onCredit: input.onCredit }),
      };
    }

    await user.save();

    // A nurse moved between physicians, or switched off or back on, is news to the
    // physicians and the nurse it touches. A corrected name is not, and says nothing.
    if (user.role === "nurse") {
      const nowDoctorId = user.nurse?.doctorId ? String(user.nurse.doctorId) : null;
      const ids = [...new Set([wasDoctorId, nowDoctorId].filter((x): x is string => Boolean(x)))];
      const doctors = ids.length
        ? await User.find({ _id: { $in: ids } }).select("name").lean<Array<{ _id: unknown; name: string }>>()
        : [];
      doctorNames = Object.fromEntries(doctors.map((d) => [String(d._id), d.name]));
      const notices = noticesForNurseChange({
        nurse: { id, name: user.name, zones: user.nurse?.serviceAreas },
        before: { doctorId: wasDoctorId, status: before.status },
        after: { doctorId: nowDoctorId, status: user.status },
        doctorNames,
      });
      for (const n of notices) await notify(n.userId, n.title, n.body, n.type, n.link);
    }

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "user.update",
      entity: "User",
      entityId: id,
      before: withDoctorName(beforeFields, doctorNames),
      after: {
        ...withDoctorName(trackedFields(user.toObject()), doctorNames),
        // A password is never written to the trail, but THAT one was set is worth knowing.
        ...(input.password ? { credentials: "new password set" } : {}),
        sessionsEnded: stopsAccess || undefined,
      },
    });

    return ok({ user: { id, name: user.name, status: user.status } });
  } catch (err) {
    return handleError(err);
  }
}
