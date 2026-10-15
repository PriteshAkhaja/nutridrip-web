/**
 * Which stored photographs may be deleted, and which must wait. Pure, so it is
 * tested (tests/media-cleanup.test.ts) and the command that acts on it
 * (scripts/clean-media.ts) has only to read and delete.
 *
 * A file is deleted only when ALL of these hold:
 *   - no photo record points to it (a file in use is never touched);
 *   - it has been out of use for the whole grace period, counted from when it
 *     was retired (replaced, restored, its drip deleted), not from its upload;
 *   - that moment is known. A file nobody has noticed before (uploaded before
 *     retiring was recorded, or left by a crash) is MARKED now and its clock
 *     starts now, so nothing is ever deleted on a first sighting.
 */

export const DEFAULT_GRACE_DAYS = 30;
const DAY = 24 * 60 * 60 * 1000;

export type StoredFile = { key: string; bytes: number };

export type CleanupPlan = {
  /** In use by a photo record: left alone. */
  inUse: StoredFile[];
  /** Out of use, still inside the grace period. */
  waiting: Array<StoredFile & { since: Date; daysLeft: number }>;
  /** Out of use and past the grace period: safe to delete. */
  remove: Array<StoredFile & { since: Date }>;
  /** Out of use with no recorded moment: its clock starts now. */
  mark: StoredFile[];
  /** Retired records whose file is already gone, and records for files now in use. */
  staleRecords: string[];
  bytes: { remove: number; waiting: number; inUse: number };
};

export function planCleanup(input: {
  files: StoredFile[];
  /** Keys that photo records point to. */
  used: Set<string>;
  /** Keys with a recorded retirement, and when. */
  retired: Map<string, Date>;
  now: Date;
  graceDays: number;
}): CleanupPlan {
  const { files, used, retired, now, graceDays } = input;
  const grace = Math.max(0, graceDays) * DAY;
  const plan: CleanupPlan = {
    inUse: [],
    waiting: [],
    remove: [],
    mark: [],
    staleRecords: [],
    bytes: { remove: 0, waiting: 0, inUse: 0 },
  };
  const present = new Set(files.map((f) => f.key));

  for (const f of [...files].sort((a, b) => a.key.localeCompare(b.key))) {
    if (used.has(f.key)) {
      plan.inUse.push(f);
      plan.bytes.inUse += f.bytes;
      if (retired.has(f.key)) plan.staleRecords.push(f.key);
      continue;
    }
    const since = retired.get(f.key);
    if (!since) {
      // A first sighting: start the clock. With no grace at all it is also due.
      if (grace === 0) {
        plan.remove.push({ ...f, since: now });
        plan.bytes.remove += f.bytes;
      } else {
        plan.mark.push(f);
        plan.waiting.push({ ...f, since: now, daysLeft: Math.ceil(grace / DAY) });
        plan.bytes.waiting += f.bytes;
      }
      continue;
    }
    const age = now.getTime() - since.getTime();
    if (age >= grace) {
      plan.remove.push({ ...f, since });
      plan.bytes.remove += f.bytes;
    } else {
      plan.waiting.push({ ...f, since, daysLeft: Math.ceil((grace - age) / DAY) });
      plan.bytes.waiting += f.bytes;
    }
  }
  for (const key of retired.keys()) if (!present.has(key)) plan.staleRecords.push(key);
  plan.staleRecords = [...new Set(plan.staleRecords)].sort();
  return plan;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
