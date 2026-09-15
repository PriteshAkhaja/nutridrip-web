import { connectDB } from "@/lib/db/mongoose";
import { Notification, User } from "@/lib/models";
import type { Role } from "@/lib/models/types";

export type NotifyType = "info" | "success" | "warning" | "error";

/**
 * A failed notification must never break the business action that triggered
 * it — a drip that was dispatched stays dispatched even if the bell fails.
 */
export async function notify(
  userId: string | null | undefined,
  title: string,
  body = "",
  type: NotifyType = "info",
  link = ""
): Promise<void> {
  try {
    if (!userId) return;
    await connectDB();
    await Notification.create({ userId, title, body, type, link });
  } catch (err) {
    console.error("notify() failed:", err);
  }
}

/** Fan out to everyone holding a role — used for queues nobody owns personally. */
export async function notifyRole(
  role: Role | Role[],
  title: string,
  body = "",
  type: NotifyType = "info",
  link = ""
): Promise<void> {
  try {
    await connectDB();
    const roles = Array.isArray(role) ? role : [role];
    const users = await User.find({ role: { $in: roles }, status: "active" })
      .select("_id")
      .lean<Array<{ _id: unknown }>>();
    if (!users.length) return;
    await Notification.insertMany(
      users.map((u) => ({ userId: u._id, title, body, type, link }))
    );
  } catch (err) {
    console.error("notifyRole() failed:", err);
  }
}
