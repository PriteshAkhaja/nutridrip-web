import { z } from "zod";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/db/mongoose";
import { OtpToken, User } from "@/lib/models";
import { normalisePhone } from "@/lib/auth/phone";
import { ok, handleError, fail } from "@/lib/api";

const Input = z.object({ phone: z.string().min(6).max(20) });

const TTL_MS = 5 * 60_000;
/** How many codes one number may request in a rolling window. */
const RATE_WINDOW_MS = 10 * 60_000;
const RATE_LIMIT = 5;

export async function POST(req: Request) {
  try {
    const raw = Input.parse(await req.json()).phone;
    const phone = normalisePhone(raw);
    if (!phone) return fail("That does not look like a phone number", 422);
    await connectDB();

    const recent = await OtpToken.countDocuments({
      phone,
      createdAt: { $gt: new Date(Date.now() - RATE_WINDOW_MS) },
    });
    if (recent >= RATE_LIMIT) return fail("Too many codes requested. Wait a few minutes.", 429);

    const code = String(Math.floor(100000 + Math.random() * 900000));

    await OtpToken.create({
      phone,
      // Explicit, though it is also the default: this code signs somebody in,
      // and must never be accepted where a prescription code is expected.
      purpose: "login",
      codeHash: await bcrypt.hash(code, 10),
      expiresAt: new Date(Date.now() + TTL_MS),
    });

    const known = await User.exists({ phone });

    // No SMS gateway is wired up yet, so the code is logged server-side and,
    // in development only, returned so the flow can be walked end to end.
    if (process.env.NODE_ENV !== "production") console.log(`[otp] ${phone} → ${code}`);

    return ok({
      sent: true,
      phone,
      isNewUser: !known,
      expiresInSec: TTL_MS / 1000,
      devCode: process.env.NODE_ENV === "production" ? undefined : code,
    });
  } catch (err) {
    return handleError(err);
  }
}
