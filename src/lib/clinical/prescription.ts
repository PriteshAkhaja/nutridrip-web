/**
 * The prescription lock.
 *
 * A session's drugs and doses are the patient's medical record. A nurse who
 * holds a booking id is not, by that fact, a nurse standing in the patient's
 * front room — so the prescription opens only once the patient has read a
 * six-digit code aloud from their own phone. It is a proof of presence, not a
 * second authentication: the nurse is already signed in and already owns the
 * session before any of this is reached.
 *
 * The unlock is recorded on the booking and lasts for that session. It is not
 * given a lifetime of its own: expiring it mid-infusion would shut the drug
 * list in the nurse's face at the worst possible moment.
 */

/** How long a prescription code is worth typing. */
export const RX_OTP_TTL_MS = 10 * 60_000;

/** Wrong guesses before the code is dead and a new one must be asked for. */
export const RX_OTP_MAX_ATTEMPTS = 5;

/** How a prescription came to be open. */
export type RxUnlockMethod = "code" | "physician" | "break_glass";

export type RxLockState = {
  unlocked: boolean;
  unlockedAt: string | null;
  method: RxUnlockMethod | null;
  /** True when it was opened without the patient's code. */
  overridden: boolean;
};

type LockInput = {
  rxUnlockedAt?: Date | null;
  rxUnlockMethod?: string | null;
} | null | undefined;

export function rxLockState(booking: LockInput): RxLockState {
  const at = booking?.rxUnlockedAt ?? null;
  // Sessions opened before the method was recorded were opened with a code,
  // because that was the only way there was.
  const method = (booking?.rxUnlockMethod ?? (at ? "code" : null)) as RxUnlockMethod | null;
  return {
    unlocked: Boolean(at),
    unlockedAt: at ? new Date(at).toISOString() : null,
    method,
    overridden: Boolean(at) && method !== "code",
  };
}

/** Plain words for the report and the audit trail. */
export const RX_METHOD_LABEL: Record<RxUnlockMethod, string> = {
  code: "the patient's code",
  physician: "a physician's authorisation",
  break_glass: "the nurse proceeding without a code",
};

/**
 * A break-glass entry has to say something. A blank reason makes the audit row
 * worthless, which is the only thing keeping this from being a plain bypass.
 */
export const RX_OVERRIDE_MIN_REASON = 10;

/**
 * How long a nurse is expected to wait on a physician before proceeding alone.
 *
 * It is guidance printed on the screen, NOT a lock. Nothing stops the nurse
 * before it elapses and nothing should: a patient can be deteriorating, and
 * holding a nurse for ten minutes to satisfy a policy is the exact trade this
 * design exists to refuse. The number is here so the nurse is told what is
 * reasonable instead of having to guess, and so the audit row can be read
 * against a stated expectation afterwards.
 */
export const RX_OVERRIDE_WAIT_MIN = 10;

/**
 * How long somebody has been waiting, in words.
 *
 * Shared by the nurse's gate and the physician's queue so the two cannot
 * disagree about it. `now` is a parameter rather than a call inside a render:
 * the physician's page is a server component, and reading the clock during
 * render is both a React purity violation and untestable.
 */
export function describeWait(since: Date | string | null | undefined, now: number = Date.now()): string | null {
  if (!since) return null;
  const mins = Math.floor((now - new Date(since).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `waiting ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `waiting ${h} h ${m} min` : `waiting ${h} h`;
}

/** True once the nurse has waited longer than anyone should be asked to. */
export function waitedLongEnough(since: Date | string | null | undefined, now: number = Date.now()): boolean {
  if (!since) return false;
  return now - new Date(since).getTime() >= RX_OVERRIDE_WAIT_MIN * 60_000;
}

/**
 * Statuses where asking the patient for a code makes sense at all. A session
 * that was cancelled or is still awaiting review has no prescription to open,
 * and a completed one is already written into the report.
 */
const OPENABLE = ["approved", "nurse_assigned", "en_route", "in_progress", "completed"];

export function canOpenPrescription(status: string): boolean {
  return OPENABLE.includes(status);
}
