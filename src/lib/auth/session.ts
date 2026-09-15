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
};

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${EXPIRY_HOURS}h`)
    .sign(secret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

/** Read the current session from the request cookie. Null when signed out. */
export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
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
