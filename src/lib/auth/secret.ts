/**
 * What may be used as JWT_SECRET in production. Pure, so it is tested
 * (tests/auth-secret.test.ts) and used by both places that read the secret: the
 * session signing key and the key that seals session codes.
 *
 * The secret has to be private. A value that is committed to the repository
 * (the placeholder in .env.example, the stand-in used in development) is known
 * to anyone who has the code, and with it anyone can sign a session cookie for
 * any account, a super admin included. So production refuses those, as well as
 * anything too short, instead of starting with a secret that looks set.
 */

/** Values that ship with the code. Never acceptable in production. */
const COMMITTED = new Set([
  "change-me-in-production-please-use-32-chars-min",
  "dev-only-insecure-secret-change-me-32chars",
]);

export const MIN_SECRET_LENGTH = 16;

/** Why this cannot be the production secret, or null if it can. */
export function jwtSecretProblem(raw: string | undefined | null): string | null {
  const v = (raw ?? "").trim();
  if (v.length < MIN_SECRET_LENGTH)
    return `JWT_SECRET must be set to at least ${MIN_SECRET_LENGTH} characters in production`;
  if (COMMITTED.has(v) || /change-?me/i.test(v)) {
    return "JWT_SECRET is still the example value from .env.example, which is public: set your own private random one in production";
  }
  return null;
}

/**
 * Throws if the app is in production and the secret cannot be used. Development
 * is left alone, so a fresh clone runs. Both places that read the secret make
 * this one call, so they cannot disagree.
 */
export function assertSecretFor(raw: string | undefined, nodeEnv: string | undefined): void {
  if (nodeEnv !== "production") return;
  const problem = jwtSecretProblem(raw);
  if (problem) throw new Error(`${problem}. For example: ${SECRET_HINT}`);
}

/** For the error message: a way to make a good one. */
export const SECRET_HINT = `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`;
