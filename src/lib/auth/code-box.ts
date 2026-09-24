import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * A session code, locked so the patient's own screen can show it.
 *
 * Codes are checked against a hash, which cannot be read back -- right for
 * checking, useless for showing the patient what to read out. So each code is
 * also kept sealed with AES-256-GCM under a key derived from the app secret:
 * unreadable in the database, readable only by the server, and only handed to
 * the patient the code was sent to (see /api/me/session-codes).
 *
 * The key follows the same rule as the session signing key: required in
 * production, a fixed stand-in in development so a fresh clone runs.
 */
function key(): Buffer {
  const raw = process.env.JWT_SECRET;
  if ((!raw || raw.length < 16) && process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set to at least 16 characters in production");
  }
  return createHash("sha256").update(`nd-session-code:${raw && raw.length >= 16 ? raw : "development-only"}`).digest();
}

/** "iv.tag.ciphertext", base64url. */
export function sealCode(code: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const body = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString("base64url")).join(".");
}

/** The code, or null for anything that is not a box this server sealed. */
export function openCode(sealed: string | null | undefined): string | null {
  try {
    const [iv, tag, body] = (sealed ?? "").split(".").map((p) => Buffer.from(p, "base64url"));
    if (!iv?.length || !tag?.length || !body?.length) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}
