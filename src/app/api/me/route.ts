import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, User } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { normalisePhone } from "@/lib/auth/phone";
import { onboardingOf } from "@/lib/auth/onboarding";
import { ok, fail, handleError } from "@/lib/api";

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", ""] as const;

const Patch = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(6).max(20).optional().or(z.literal("")),

  /* Patient record — the nurse reads the last four aloud before every session. */
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  gender: z.enum(["male", "female", "other", "undisclosed"]).optional(),
  bloodGroup: z.enum(BLOOD_GROUPS).optional(),
  heightCm: z.number().min(50).max(250).nullable().optional(),
  weightKg: z.number().min(10).max(400).nullable().optional(),
  address: z.string().max(300).optional(),
  city: z.string().max(80).optional(),
  pincode: z.string().regex(/^\d{6}$/).optional().or(z.literal("")),
  /** Sent together, from the map picker. Null clears them. */
  latitude: z.number().min(-90).max(90).nullable().optional(),
  longitude: z.number().min(-180).max(180).nullable().optional(),
  emergencyContactName: z.string().max(120).optional(),
  emergencyContactPhone: z.string().max(20).optional(),
  allergies: z.string().max(500).optional(),
  chronicConditions: z.string().max(500).optional(),
  currentMedications: z.string().max(500).optional(),
  surgeries: z.string().max(500).optional(),
  familyHistory: z.string().max(500).optional(),
});

const PATIENT_TEXT = [
  "address", "city", "emergencyContactName", "allergies", "chronicConditions",
  "currentMedications", "surgeries", "familyHistory",
] as const;

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);
    await connectDB();
    const me = await User.findById(session.sub).select("-passwordHash").lean();
    if (!me) return fail("Account not found", 404);
    return ok({ me });
  } catch (err) {
    return handleError(err);
  }
}

/** A person updates their own details. Role and status are not theirs to change. */
export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);

    const input = Patch.parse(await req.json());

    // A latitude without a longitude is not a location.
    if ((input.latitude === undefined) !== (input.longitude === undefined)) {
      return fail("Latitude and longitude must be sent together", 422);
    }
    await connectDB();

    const user = await User.findById(session.sub);
    if (!user) return fail("Account not found", 404);

    // Captured before anything is mutated, so a field that was already blank
    // can stay blank while one that was filled in cannot be emptied.
    const before = onboardingOf({
      name: user.name,
      patient: user.patient as { address?: string; city?: string; pincode?: string } | undefined,
    });

    if (input.name) user.name = input.name;

    if (input.email !== undefined) {
      const email = input.email.toLowerCase();
      if (email) {
        if (await User.exists({ email, _id: { $ne: user._id } })) return fail("That email address belongs to another account", 409);
        user.email = email;
      } else if (user.role === "patient") {
        user.email = undefined;
      }
    }

    if (input.phone) {
      const phone = normalisePhone(input.phone);
      if (!phone) return fail("That phone number does not look right", 422);
      if (await User.exists({ phone, _id: { $ne: user._id } })) return fail("That phone number belongs to another account", 409);
      user.phone = phone;
    }

    if (user.role === "patient") {
      const p = { ...(user.patient ?? {}) } as Record<string, unknown>;
      if (input.dob !== undefined) p.dob = input.dob ? new Date(input.dob) : undefined;
      if (input.gender !== undefined) p.gender = input.gender;
      if (input.bloodGroup !== undefined) p.bloodGroup = input.bloodGroup || undefined;
      if (input.heightCm !== undefined) p.heightCm = input.heightCm ?? undefined;
      if (input.weightKg !== undefined) p.weightKg = input.weightKg ?? undefined;
      if (input.pincode !== undefined) p.pincode = input.pincode || undefined;

      // Coordinates were geocoded from the old address. Leaving them in place
      // would send the next nurse to the previous home, so a change of address
      // or pincode clears them and dispatch falls back to zone matching until
      // they are set again.
      const movedHouse =
        (input.address !== undefined && input.address !== (user.patient?.address ?? "")) ||
        (input.pincode !== undefined && input.pincode !== (user.patient?.pincode ?? ""));
      if (movedHouse) {
        p.latitude = undefined;
        p.longitude = undefined;
      }

      // A pin the patient picked or dragged arrives in the SAME request as the
      // address it belongs to, so it has to be applied after the moved-house
      // reset above — otherwise saving a new address and its coordinates
      // together would immediately throw the coordinates away.
      if (input.latitude !== undefined) {
        p.latitude = input.latitude ?? undefined;
        p.longitude = input.longitude ?? undefined;
      }
      if (input.emergencyContactPhone !== undefined) {
        const ec = input.emergencyContactPhone ? normalisePhone(input.emergencyContactPhone) : null;
        if (input.emergencyContactPhone && !ec) return fail("The emergency contact's number does not look right", 422);
        p.emergencyContactPhone = ec ?? undefined;
      }
      for (const key of PATIENT_TEXT) {
        if (input[key] !== undefined) p[key] = input[key] || undefined;
      }

      /**
       * Clearing an address that was already on file is not an edit, it is a
       * lockout: the next page load fails the onboarding check and bounces the
       * patient back to /welcome, losing whatever else they were changing in
       * the same save. So a field that was valid may be changed but not
       * emptied — and one that was already blank is left alone, which keeps
       * half-finished records editable.
       */
      const after = onboardingOf({
        name: user.name,
        patient: p as { address?: string; city?: string; pincode?: string },
      });
      const regressed = after.missing.filter((field) => !before.missing.includes(field));

      if (regressed.length > 0) {
        const LABEL: Record<string, string> = {
          name: "your name",
          address: "your address",
          city: "your city",
          pincode: "a six-digit pincode",
        };
        const list = regressed.map((f) => LABEL[f] ?? f).join(", ");
        return fail(
          `We still need ${list} — a nurse has to have somewhere to come. Change it rather than clearing it.`,
          422
        );
      }

      user.patient = p;
    }

    await user.save();

    await AuditLog.create({
      actorId: session.sub,
      actorRole: session.role,
      action: "profile.update",
      entity: "User",
      entityId: String(user._id),
      after: { fields: Object.keys(input) },
    });

    return ok({ name: user.name, email: user.email, phone: user.phone });
  } catch (err) {
    return handleError(err);
  }
}
