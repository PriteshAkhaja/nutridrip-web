import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, User } from "@/lib/models";
import { verifyPassword } from "@/lib/auth/password";
import { signSession, setSessionCookie } from "@/lib/auth/session";
import { HOME_FOR_ROLE } from "@/lib/auth/rbac";
import { ok, fail, handleError } from "@/lib/api";

const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function POST(req: Request) {
  try {
    const { email, password } = LoginInput.parse(await req.json());
    await connectDB();

    const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
    // Same message either way, so the form cannot be used to enumerate accounts.
    if (!user || !user.passwordHash) return fail("Email or password is incorrect", 401);

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return fail("Too many attempts. Try again in a few minutes.", 429);
    }

    if (!(await verifyPassword(password, user.passwordHash))) {
      user.failedLoginCount = (user.failedLoginCount ?? 0) + 1;
      if (user.failedLoginCount >= MAX_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60_000);
        user.failedLoginCount = 0;
      }
      await user.save();
      return fail("Email or password is incorrect", 401);
    }

    if (user.status !== "active") return fail("This account is not active", 403);

    user.failedLoginCount = 0;
    user.lockedUntil = undefined;
    user.lastLoginAt = new Date();
    await user.save();

    /**
     * Who got in, and when.
     *
     * Refusals were recorded from the start and entries were not, which left
     * the trail able to answer "who was turned away" but not "who was here" —
     * the first question anyone actually asks of an audit log. The PRD files
     * audit logging under compliance, beside GDPR and medical data protection,
     * and half a record does not meet that.
     *
     * Failed attempts stay out on purpose: the lockout counter already bounds
     * them, and logging every wrong password would let anyone flood the trail
     * from the sign-in page without an account.
     */
    await AuditLog.create({
      actorId: user._id,
      actorRole: user.role,
      action: "auth.signed_in",
      entity: "User",
      entityId: String(user._id),
      after: { method: "password" },
    });

    const token = await signSession({
      sub: String(user._id),
      role: user.role,
      name: user.name,
      email: user.email,
      // Stamped so this token can be ended later without waiting for it to
      // expire — see tokenVersion on the User model.
      v: user.tokenVersion ?? 0,
    });
    await setSessionCookie(token);

    return ok({
      user: { id: String(user._id), name: user.name, role: user.role, email: user.email },
      redirectTo: HOME_FOR_ROLE[user.role as keyof typeof HOME_FOR_ROLE],
    });
  } catch (err) {
    return handleError(err);
  }
}
