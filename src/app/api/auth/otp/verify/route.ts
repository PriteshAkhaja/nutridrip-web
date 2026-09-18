import { z } from "zod";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, OtpToken, User } from "@/lib/models";
import { signSession, setSessionCookie } from "@/lib/auth/session";
import { HOME_FOR_ROLE } from "@/lib/auth/rbac";
import { normalisePhone } from "@/lib/auth/phone";
import { ok, fail, handleError } from "@/lib/api";

const Input = z.object({
  phone: z.string().min(6).max(20),
  code: z.string().length(6),
  name: z.string().min(1).max(80).optional(),
});

const MAX_ATTEMPTS = 5;

export async function POST(req: Request) {
  try {
    const { phone: raw, code, name } = Input.parse(await req.json());
    const phone = normalisePhone(raw);
    if (!phone) return fail("That does not look like a phone number", 422);
    await connectDB();

    // Scoped to sign-in codes. A prescription code is issued to this same
    // phone, and without this filter it would open a session as the patient.
    // `$ne` rather than `eq` so codes written before purposes existed still work.
    const token = await OtpToken.findOne({
      phone,
      consumedAt: null,
      purpose: { $ne: "prescription" },
    }).sort({ createdAt: -1 });
    if (!token) return fail("Request a new code", 400);
    if (token.expiresAt < new Date()) return fail("That code has expired", 400);
    if (token.attempts >= MAX_ATTEMPTS) return fail("Too many attempts. Request a new code.", 429);

    if (!(await bcrypt.compare(code, token.codeHash))) {
      token.attempts += 1;
      await token.save();
      return fail("That code is not right", 401);
    }

    token.consumedAt = new Date();
    await token.save();

    // Patients sign in by phone; the first verified code creates the account.
    let user = await User.findOne({ phone });

    // A staff number must never open a staff session this way. Doctors, nurses,
    // clinics and admins hold credentials that a six-digit code does not
    // substitute for — a prescribing login especially — so phone sign-in is
    // limited to patients even when the number is on a staff record.
    if (user && user.role !== "patient") {
      return fail("That number belongs to a staff account. Staff sign in with an email address and password.", 403);
    }

    if (!user) {
      user = await User.create({
        phone,
        name: name?.trim() || "New patient",
        role: "patient",
        status: "active",
      });
    }
    if (user.status !== "active") return fail("This account is not active", 403);

    const isNew = !user.lastLoginAt;
    user.lastLoginAt = new Date();
    await user.save();

    // The patient half of the same record. A trail that logged staff sign-ins
    // and not patient ones would answer "who was here" only for half the people
    // who were.
    await AuditLog.create({
      actorId: user._id,
      actorRole: user.role,
      action: "auth.signed_in",
      entity: "User",
      entityId: String(user._id),
      after: { method: "otp", ...(isNew ? { firstTime: true } : {}) },
    });

    const jwt = await signSession({
      sub: String(user._id),
      role: user.role,
      name: user.name,
      email: user.email,
      v: user.tokenVersion ?? 0,
    });
    await setSessionCookie(jwt);

    return ok({
      user: { id: String(user._id), name: user.name, role: user.role },
      redirectTo: HOME_FOR_ROLE[user.role as keyof typeof HOME_FOR_ROLE] ?? "/app",
    });
  } catch (err) {
    return handleError(err);
  }
}
