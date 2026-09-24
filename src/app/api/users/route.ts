import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, User } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { hashPassword } from "@/lib/auth/password";
import { notify } from "@/lib/notify";
import { ROLES } from "@/lib/models/types";
import { normalisePhone } from "@/lib/auth/phone";
import { checkGstin } from "@/lib/billing/gst";
import { paginate } from "@/lib/pagination-db";
import { pageInfo, parsePaging } from "@/lib/pagination";
import { adminSafeUser } from "@/lib/data/admin-view";
import { accountReadyBody, joinedTeam } from "@/lib/data/team-notices";
import { ok, fail, handleError } from "@/lib/api";

// The messages are what somebody adding a nurse reads in the form, so they say
// what to do ("use at least 8 characters"), not what the validator saw
// ("Too small: expected string to have >=8 characters"). handleError puts the
// field name in front: "password: use at least 8 characters".
const CreateUser = z.object({
  name: z.string().min(1, "enter a name").max(120, "that name is too long"),
  role: z.enum(ROLES),
  email: z.string().email("that address does not look right").optional().or(z.literal("")),
  phone: z.string().min(6, "that number does not look right").max(20, "that number does not look right").optional().or(z.literal("")),
  /** Staff sign in with a password; patients use a phone code and need none. */
  password: z.string().min(8, "use at least 8 characters").max(72, "use 72 characters or fewer").optional(),

  specialization: z.string().max(120).optional(),
  licenseNo: z.string().max(60).optional(),
  registrationCouncil: z.string().max(120).optional(),
  serviceAreas: z.array(z.string().max(60)).optional(),
  /** The physician a nurse works under. */
  doctorId: z.string().max(40).nullable().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),

  address: z.string().max(300).optional(),
  city: z.string().max(80).optional(),
  pincode: z.string().max(10).optional(),
  gstin: z.string().max(20).optional(),
  monthlyVolumeTarget: z.number().int().min(0).max(10000).optional(),
  /** A clinic on credit is invoiced after dispatch; otherwise it pays for each order first. */
  onCredit: z.boolean().optional(),
});

/** Roles that must be able to sign in with a password, so one is required. */
const PASSWORD_ROLES = ["superadmin", "admin", "doctor", "nurse", "clinic"];

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "users.view")) return fail("Not permitted", 403);

    await connectDB();
    const params = new URL(req.url).searchParams;
    const filter: Record<string, unknown> = {};
    const role = params.get("role");
    if (role && (ROLES as readonly string[]).includes(role)) filter.role = role;
    const q = params.get("q");
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
    }

    const paging = parsePaging({ page: params.get("page"), pageSize: params.get("pageSize") });
    const { rows: users, meta } = await paginate(User, filter, { sort: { createdAt: -1 }, paging });
    // A patient's medical profile is not an Admin's to read: they get contact and
    // place only. A super admin, who may open the full record, gets it whole.
    return ok({
      users: session!.role === "admin" ? users.map((u) => adminSafeUser(u)) : users,
      pagination: pageInfo(meta),
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    // Creating people is the one thing an ordinary admin cannot do — a doctor
    // account is a prescribing credential, so it stays with the owner.
    if (!can(session?.role, "users.manage")) return fail("Only a super admin can create accounts", 403);

    const input = CreateUser.parse(await req.json());
    // A clinic's GSTIN decides whether their invoice carries CGST+SGST or
    // IGST, so a malformed one is a wrongly taxed bill rather than a cosmetic
    // slip. Checked here as well as on the form, because the form is not the
    // only way in.
    if (input.gstin) {
      const verdict = checkGstin(input.gstin);
      if (verdict.error) return fail(verdict.error, 422);
    }
    const phone = input.phone ? normalisePhone(input.phone) : undefined;
    if (input.phone && !phone) return fail("That phone number does not look right", 422);
    if (!input.email && !input.phone) return fail("An email address or a phone number is required", 422);
    if (PASSWORD_ROLES.includes(input.role)) {
      if (!input.email) return fail(`A ${input.role} signs in by email, so an address is required`, 422);
      if (!input.password) return fail(`A ${input.role} signs in with a password — set one of at least 8 characters`, 422);
    }

    await connectDB();

    if (input.email && (await User.exists({ email: input.email.toLowerCase() }))) {
      return fail("That email address already has an account", 409);
    }
    if (phone && (await User.exists({ phone }))) {
      return fail("That phone number already has an account", 409);
    }

    const doc: Record<string, unknown> = {
      name: input.name,
      role: input.role,
      email: input.email || undefined,
      phone: phone || undefined,
      status: "active",
    };
    if (input.password) doc.passwordHash = await hashPassword(input.password);

    if (input.role === "doctor") {
      doc.doctor = {
        specialization: input.specialization,
        licenseNo: input.licenseNo,
        registrationCouncil: input.registrationCouncil,
      };
    }
    let doctorName: string | undefined;
    if (input.role === "nurse") {
      // Checked rather than trusted: a nurse pointed at a patient account would
      // put that patient's name in a physician's dispatch list.
      if (input.doctorId) {
        const doctor = await User.findById(input.doctorId).lean<{ role: string; name: string } | null>();
        if (!doctor || doctor.role !== "doctor") return fail("That is not a physician account", 422);
        doctorName = doctor.name;
      }
      doc.nurse = {
        licenseNo: input.licenseNo,
        doctorId: input.doctorId || undefined,
        serviceAreas: input.serviceAreas ?? [],
        latitude: input.latitude,
        longitude: input.longitude,
      };
    }
    if (input.role === "clinic") {
      doc.clinic = {
        address: input.address,
        city: input.city,
        pincode: input.pincode,
        gstin: input.gstin,
        monthlyVolumeTarget: input.monthlyVolumeTarget,
        onCredit: input.onCredit ?? false,
        partnerSince: new Date(),
      };
    }
    if (input.role === "patient") {
      doc.patient = {
        address: input.address,
        city: input.city,
        pincode: input.pincode,
        latitude: input.latitude,
        longitude: input.longitude,
      };
    }

    const user = await User.create(doc);

    await notify(
      String(user._id),
      "Your NutriDrip account is ready",
      accountReadyBody({ email: input.email, doctorName }),
      "success",
      "/login"
    );

    // The physician a nurse works under dispatches them and answers for their
    // sessions, so they hear about it now -- not when the name first turns up in
    // the middle of an approval.
    if (input.role === "nurse" && input.doctorId) {
      const n = joinedTeam({ name: input.name, zones: input.serviceAreas }, input.doctorId);
      await notify(n.userId, n.title, n.body, n.type, n.link);
    }
    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "user.create",
      entity: "User",
      entityId: String(user._id),
      after: { name: input.name, role: input.role, email: input.email },
    });

    return ok(
      { user: { id: String(user._id), name: user.name, role: user.role, email: user.email } },
      { status: 201 }
    );
  } catch (err) {
    return handleError(err);
  }
}
