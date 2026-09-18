import { cache } from "react";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/lib/models/types";

const DEV_SECRET = "dev-only-insecure-secret-change-me-32chars";
const COOKIE = "nd_session";
const EXPIRY_HOURS = Number(process.env.SESSION_EXPIRY_HOURS ?? 24);

/**
 * The signing key. A missing secret is tolerated in development so the app
 * runs from a fresh clone, and refused in production so a session can never be
 * forged with a value that is committed to the repository.
 */
function secret(): Uint8Array {
  const raw = process.env.JWT_SECRET;
  if (!raw || raw.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("JWT_SECRET must be set to at least 16 characters in production");
    }
    return new TextEncoder().encode(DEV_SECRET);
  }
  return new TextEncoder().encode(raw);
}

export type SessionPayload = {
  sub: string;
  role: Role;
  name: string;
  email?: string;
  /**
   * The account's token version when this was issued.
   *
   * Absent on tokens signed before revocation existed; those are treated as
   * version 0, which is what every account starts at, so nobody is thrown out
   * by the upgrade itself.
   */
  v?: number;
};

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRY_HOURS}h`)
    .sign(secret());
}

/** Signature and expiry only. Says nothing about whether the account still stands. */
export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/**
 * Whether the account behind a valid token is still entitled to it.
 *
 * A signature proves the token was issued by us; it cannot know that the
 * person was dismissed an hour ago. This is the one place that asks, and it is
 * inside `getSession` rather than beside it so that none of the fifty-odd
 * callers can forget to.
 *
 * Wrapped in React's `cache` so a page that reads the session five times
 * charges one lookup per request rather than five.
 *
 * A database that cannot be reached returns `true`: refusing every request
 * during a blip would turn a slow database into a total outage, and the token
 * is still signed and unexpired. The tradeoff is deliberate and narrow — it
 * only widens the window a revoked token survives.
 */
const accountStillValid = cache(async (sub: string, tokenVersion: number): Promise<boolean> => {
  try {
    const { connectDB } = await import("@/lib/db/mongoose");
    const { User } = await import("@/lib/models");
    await connectDB();
    const user = await User.findById(sub)
      .select("status tokenVersion")
      .lean<{ status?: string; tokenVersion?: number } | null>();

    if (!user) return false;
    if (user.status !== "active") return false;
    return (user.tokenVersion ?? 0) === tokenVersion;
  } catch (err) {
    console.error("accountStillValid() could not check, allowing the token:", err);
    return true;
  }
});

/**
 * The current session, or null when there is none — including when the account
 * has been deactivated or its sessions revoked since the token was issued.
 */
export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;

  const payload = await verifySession(token);
  if (!payload?.sub) return null;

  const live = await accountStillValid(payload.sub, payload.v ?? 0);
  return live ? payload : null;
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: EXPIRY_HOURS * 3600,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE);
}

export const SESSION_COOKIE = COOKIE;
