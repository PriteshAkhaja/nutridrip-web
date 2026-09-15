import type { Model } from "mongoose";

/**
 * Human-readable references like PO-2026-0113 and ND-4417.
 *
 * Deriving these from a document *count* is a trap: delete one record and the
 * next insert reuses a number the unique index already holds, and two
 * simultaneous creates both read the same count. So read the highest number
 * actually in use, and retry on the unique-index error rather than trusting
 * the read to still be true by the time the write lands.
 */
/**
 * How many recent references to weigh up. References are handed out in
 * increasing order, so the highest is among the most recently created; a
 * window this size covers any realistic burst.
 */
const WINDOW = 200;

export async function nextReference<T>(
  model: Model<T>,
  field: string,
  build: (n: number) => string,
  parse: (ref: string) => number,
  attempt = 0
): Promise<string> {
  // These are strings, so sorting on the field itself is a byte comparison:
  // "ND-9999" sorts above "ND-10000" and the next number would repeat one the
  // unique index already holds. Take a window of the most recent and pick the
  // numerically highest, which is what "the highest in use" actually means.
  const recent = await model
    .find({ [field]: { $exists: true } })
    .sort({ createdAt: -1, _id: -1 })
    .limit(WINDOW)
    .select(field)
    .lean<Array<Record<string, string>>>();

  let current = 0;
  for (const row of recent) {
    const raw = row?.[field];
    if (!raw) continue;
    const n = parse(raw);
    if (Number.isFinite(n) && n > current) current = n;
  }

  return build(current + 1 + attempt);
}

/** Retries a create when a unique reference collides with a concurrent write. */
export async function createWithReference<R>(
  make: (reference: string) => Promise<R>,
  reference: (attempt: number) => Promise<string>,
  maxAttempts = 5
): Promise<R> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await make(await reference(attempt));
    } catch (err) {
      const duplicate =
        typeof err === "object" && err !== null && (err as { code?: number }).code === 11000;
      if (!duplicate || attempt === maxAttempts - 1) throw err;
    }
  }
  throw new Error("Could not allocate a reference");
}
