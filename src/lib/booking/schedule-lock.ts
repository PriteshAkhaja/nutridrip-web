import type { ClientSession } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Lock } from "@/lib/models";

/**
 * One change to the nurse schedule at a time, whichever server it runs on.
 *
 * Booking a slot, moving a session, a physician's approval and a reassignment
 * each read who is free and then write who is busy. Two of them at the same
 * moment could each see the last nurse free -- two patients paid, one nurse.
 * So each runs inside a transaction whose first write is to one shared lock
 * document. Only one open transaction can hold that write: a second meets a
 * write conflict, is rolled back, and runs again once the first has committed
 * -- this time seeing what the first wrote, and refusing if the time has gone.
 *
 * `fn` may therefore run more than once. It only reads, and writes with
 * `session`; notifications, audit rows and anything outside the database
 * belong after it returns. Needs a replica set, as order confirm and dispatch do.
 */

const NAME = "nurse-schedule";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let ready: Promise<unknown> | null = null;

export async function withScheduleLock<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
  const conn = await connectDB();
  // Made once, outside any transaction, so a transaction never has to create it.
  ready ??= Lock.updateOne({ _id: NAME }, { $setOnInsert: { v: 0 } }, { upsert: true }).catch((err: unknown) => {
    ready = null;
    throw err;
  });
  await ready;

  let attempt = 0;
  return conn.connection.transaction(async (session) => {
    // Another holder is part-way through: give it a moment rather than spinning.
    if (attempt++ > 0) await sleep(15 + Math.random() * 40 * Math.min(attempt, 6));
    // An upsert, so a lock document removed since (a wiped collection) is made
    // again inside the transaction rather than the write silently matching nothing.
    const held = await Lock.updateOne(
      { _id: NAME },
      { $inc: { v: 1 }, $set: { at: new Date() } },
      { session, upsert: true }
    );
    if (!held.matchedCount && !held.upsertedCount) throw new Error("The schedule lock could not be taken");
    return fn(session);
  });
}

/** Why something cannot be done, and the status to say it with. Handed out of the lock, it commits nothing. */
export type Refusal = { error: string; status: number; extra?: Record<string, unknown> };
export const isRefusal = (x: unknown): x is Refusal =>
  typeof x === "object" && x !== null && "error" in x && "status" in x;
