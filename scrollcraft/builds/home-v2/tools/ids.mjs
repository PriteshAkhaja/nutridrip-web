// Read-only: real ids for the pages only reachable from data (a nurse's
// sessions, a report, an invoice), so the colour crawl can open them.
import fs from "node:fs";
import mongoose from "mongoose";
const env = Object.fromEntries(
  fs
    .readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, "")];
    })
);
await mongoose.connect(env.MONGODB_URI);
const db = mongoose.connection.db;
const user = (q) => db.collection("users").findOne(q, { projection: { _id: 1 } });
const nurse = await user({ email: "nurse.emma@nutridrip.com" });
const patient = await user({ phone: { $in: ["+919844471234", "9844471234"] } });
const clinic = await user({ email: "clinic@healthfirst.com" });
const nurseSessions = await db
  .collection("bookings")
  .find({ nurseId: nurse?._id }, { projection: { status: 1 } })
  .sort({ _id: -1 })
  .toArray();
const done = await db
  .collection("bookings")
  .find({ patientId: patient?._id, status: "completed" }, { projection: { _id: 1 } })
  .limit(1)
  .toArray();
const inv = await db
  .collection("invoices")
  .find({ clinicId: clinic?._id }, { projection: { orderId: 1 } })
  .limit(1)
  .toArray();
const anyInv = await db
  .collection("invoices")
  .find({}, { projection: { orderId: 1 } })
  .limit(1)
  .toArray();
console.log(
  JSON.stringify({
    nurse: nurseSessions.map((b) => [String(b._id), b.status]),
    report: done.map((b) => String(b._id)),
    clinicInvoice: inv.map((i) => String(i.orderId)),
    anyInvoice: anyInv.map((i) => String(i.orderId)),
  })
);
await mongoose.disconnect();
