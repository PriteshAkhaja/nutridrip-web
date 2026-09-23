import type { SessionPayload } from "@/lib/auth/session";

/**
 * Recording that somebody opened a patient's clinical record.
 *
 * The privacy policy tells patients that "every access attempt against a
 * clinical record is written to an audit log". Refusals were written from the
 * start; successful opens were not, so the log could say who had been turned
 * away but not who had actually read the record — which is the question a
 * patient asks, and the one a regulator asks after them.
 *
 * ── On volume ──────────────────────────────────────────────────────────────
 * This is the expensive half of that promise, and it is deliberate. A row is
 * written every time a record is opened, including the same record twice in a
 * minute, because "I opened it twice" is the truth and any deduplication would
 * quietly reintroduce the gap this closes.
 *
 * What keeps it bounded is scope, not suppression: only a *patient's clinical
 * record* is logged — a chart, a session, a prescription, a lab file, an
 * assessment. Console lists, dashboards and settings screens are not somebody's
 * medical record and are not logged.
 * ───────────────────────────────────────────────────────────────────────────
 *
 * Failures are swallowed. A log that cannot be written must not stop a nurse
 * opening a chart at the bedside; the write is best-effort and says so.
 */
export type RecordKind =
  | "patient chart"
  | "patient profile"
  | "session"
  | "prescription"
  | "lab report"
  | "assessment"
  | "treatment plan";

export async function logRecordAccess(opts: {
  session: Pick<SessionPayload, "sub" | "role">;
  kind: RecordKind;
  /** The record opened. */
  entity: string;
  entityId: string;
  /** Whose record it is, when that is not the reader themselves. */
  patientId?: string;
  /** Anything worth knowing later — "printed", "downloaded". */
  note?: string;
}): Promise<void> {
  try {
    const { connectDB } = await import("@/lib/db/mongoose");
    const { AuditLog } = await import("@/lib/models");
    await connectDB();

    await AuditLog.create({
      actorId: opts.session.sub,
      actorRole: opts.session.role,
      action: "record.opened",
      entity: opts.entity,
      entityId: opts.entityId,
      after: {
        kind: opts.kind,
        // Marked so "who read this patient's record" is one query, and so a
        // patient reading their own is distinguishable from staff reading it.
        ...(opts.patientId ? { patientId: opts.patientId } : {}),
        own: opts.patientId ? opts.patientId === opts.session.sub : true,
        ...(opts.note ? { note: opts.note } : {}),
      },
    });
  } catch (err) {
    console.error("logRecordAccess() could not write:", err);
  }
}
