import { User } from "@/lib/models";
import { describeWait } from "@/lib/clinical/prescription";
import type { OverrideState } from "@/app/nurse/session/[id]/PrescriptionGate";

/**
 * The state of an override request, in the words the nurse needs.
 *
 * Both screens that can be locked — the prescription and the kit check — show
 * the same gate, so they read this rather than each assembling it. Two copies
 * of the same shape is how one of them quietly stops showing the refusal.
 *
 * Dates are formatted HERE, on the server. The gate is a client component but
 * server-renders first, and a date formatted on both sides resolves in two
 * different time zones — a hydration mismatch, not a cosmetic difference.
 */
export type OverrideSource = {
  doctorId?: unknown;
  rxOverride?: {
    requestedAt?: Date | null;
    lastAskedAt?: Date | null;
    reason?: string | null;
    deniedAt?: Date | null;
    deniedBy?: unknown;
    denyReason?: string | null;
  } | null;
} | null;

const when = (d?: Date | null): string | null =>
  d
    ? new Date(d).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      })
    : null;

const nameOf = async (id: unknown): Promise<string | null> =>
  id ? ((await User.findById(id).lean<{ name: string } | null>())?.name ?? null) : null;

export async function rxOverrideView(booking: OverrideSource): Promise<OverrideState> {
  const o = booking?.rxOverride ?? null;

  /**
   * The physician's own number, so a nurse who is waiting can ring rather than
   * refresh. A bell notification is no use to somebody in theatre, and a nurse
   * standing in a patient's front room should not have to choose between
   * waiting indefinitely and going in alone when a phone call would settle it.
   */
  const doctor = booking?.doctorId
    ? await User.findById(booking.doctorId).lean<{ name: string; phone?: string } | null>()
    : null;

  // A chase is only worth showing when it actually happened after the first
  // ask; otherwise the two timestamps are the same moment said twice.
  const chased =
    o?.lastAskedAt && o?.requestedAt && new Date(o.lastAskedAt).getTime() !== new Date(o.requestedAt).getTime()
      ? o.lastAskedAt
      : null;

  return {
    asked: Boolean(o?.requestedAt),
    askedAt: when(o?.requestedAt),
    chasedAt: when(chased),
    reason: o?.reason ?? null,
    askedWho: doctor?.name ?? null,
    askedPhone: doctor?.phone ?? null,
    // Sent as an ISO string as well as words, so the gate can keep counting
    // after the page has been sitting open.
    askedAtIso: o?.requestedAt ? new Date(o.requestedAt).toISOString() : null,
    waited: describeWait(o?.requestedAt),
    denied: Boolean(o?.deniedAt),
    deniedAt: when(o?.deniedAt),
    deniedWho: await nameOf(o?.deniedBy),
    denyReason: o?.denyReason ?? null,
  };
}
