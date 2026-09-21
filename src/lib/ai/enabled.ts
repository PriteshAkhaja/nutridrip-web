/**
 * The one switch for AI Studio.
 *
 * OFF for now. The code is all still here — the page, the API, the model and the
 * tests — and turning this to `true` brings the whole thing back: the nav link
 * returns, /admin/studio opens for a super admin, and the API answers.
 *
 * While it is off, the page is a plain 404 (not a refusal, so nobody following
 * an old link writes a refused-access row) and every API route answers 404.
 *
 * Nothing in the app reads the saved settings either way — see lib/ai/config.ts.
 */
export const AI_STUDIO_ENABLED = false;
