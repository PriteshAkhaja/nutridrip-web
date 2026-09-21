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

/** Serves the paged, filtered trail: the filter, then the sort, so a page is an index walk. */
AuditLogSchema.index({ at: -1, _id: -1 });
AuditLogSchema.index({ action: 1, at: -1, _id: -1 });
AuditLogSchema.index({ actorId: 1, at: -1, _id: -1 });

export const AuditLog = models.AuditLog || model("AuditLog", AuditLogSchema);
export default AuditLog;
