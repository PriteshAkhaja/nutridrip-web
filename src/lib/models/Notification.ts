import { Schema, model, models } from "mongoose";

/**
 * The spine that makes the roles feel like one system: every state change a
 * person needs to know about writes one of these. Read by the bell in both
 * shells.
 */
const NotificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    type: { type: String, enum: ["info", "success", "warning", "error"], default: "info" },
    /** Where clicking it should take the reader. */
    link: { type: String, default: "" },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const Notification = models.Notification || model("Notification", NotificationSchema);
export default Notification;
