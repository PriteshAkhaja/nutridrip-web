import { Schema, model, models } from "mongoose";

/**
 * A named lock, taken by writing to it inside a transaction.
 *
 * MongoDB lets only one open transaction hold a write on a document. A second
 * transaction that writes the same lock meets a write conflict, is rolled back
 * and runs again once the first has committed -- by which time it sees
 * everything the first wrote. See lib/booking/schedule-lock.ts.
 */
const LockSchema = new Schema(
  {
    _id: { type: String, required: true },
    /** Bumped on every hold: the write two holders collide on. */
    v: { type: Number, default: 0 },
    at: Date,
  },
  { versionKey: false }
);

export const Lock = models.Lock || model("Lock", LockSchema);
export default Lock;
