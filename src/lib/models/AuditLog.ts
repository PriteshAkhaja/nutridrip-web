import { Schema, model, models } from "mongoose";

/** Append-only trail for clinical and admin actions. */
const AuditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    actorRole: String,
    action: { type: String, required: true, index: true },
    entity: String,
    entityId: String,
    before: Schema.Types.Mixed,
    after: Schema.Types.Mixed,
    ip: String,
    at: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false }
);

export const AuditLog = models.AuditLog || model("AuditLog", AuditLogSchema);
export default AuditLog;
