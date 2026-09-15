import { connectDB } from "@/lib/db/mongoose";
import { Notification } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { ok, fail, handleError } from "@/lib/api";

/** The caller's own notifications, newest first, plus the unread count. */
export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);

    await connectDB();
    const limit = Math.min(50, Number(new URL(req.url).searchParams.get("limit")) || 20);

    const [items, unread] = await Promise.all([
      Notification.find({ userId: session.sub })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean<
          Array<{
            _id: unknown;
            title: string;
            body: string;
            type: string;
            link: string;
            isRead: boolean;
            createdAt: Date;
          }>
        >(),
      Notification.countDocuments({ userId: session.sub, isRead: false }),
    ]);

    return ok({
      unread,
      items: items.map((n) => ({
        id: String(n._id),
        title: n.title,
        body: n.body,
        type: n.type,
        link: n.link,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    return handleError(err);
  }
}

/** Mark one read ({ id }) or all of them ({ all: true }). Ownership enforced. */
export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);

    const body = await req.json().catch(() => ({}));
    await connectDB();

    if (body.all === true) {
      await Notification.updateMany(
        { userId: session.sub, isRead: false },
        { $set: { isRead: true } }
      );
    } else if (typeof body.id === "string" && body.id) {
      // Scoped to the caller so an id from elsewhere cannot be marked read.
      const res = await Notification.updateOne(
        { _id: body.id, userId: session.sub },
        { $set: { isRead: true } }
      );
      if (res.matchedCount === 0) return fail("Notification not found", 404);
    } else {
      return fail("Provide an id or all:true", 400);
    }

    const unread = await Notification.countDocuments({ userId: session.sub, isRead: false });
    return ok({ unread });
  } catch (err) {
    return handleError(err);
  }
}
