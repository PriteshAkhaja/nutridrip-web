/**
 * Tear up an invoice so it can be raised again.
 *
 *   node scripts/reset-invoice.mjs PO-2026-0110     one order's invoice
 *   node scripts/reset-invoice.mjs --all            every invoice
 *
 * DEVELOPMENT ONLY. An invoice number is issued once and then stands — that is
 * the whole point of the unique index behind it, and it is why changing the
 * GSTIN does not rewrite a bill already downloaded. Deleting one breaks the
 * consecutive series a GST return is filed against, and reissuing the same
 * number against different figures is the kind of thing that has to be
 * explained to an auditor.
 *
 * It exists because testing the settings — registered or not, rated or exempt,
 * in state or out — means seeing a fresh document each time. The guard below
 * refuses to run anywhere that might not be a scratch database.
 */
import { MongoClient } from "mongodb";
import "dotenv/config";

/* ------------------------------------------------------------------ */
/* Guard                                                               */
/* ------------------------------------------------------------------ */

const uri = process.env.MONGODB_URI ?? "";

const stop = (why, hint) => {
  console.error(`\nRefusing to run — ${why}`);
  console.error("Deleting an invoice breaks the numbered series it belongs to.");
  if (hint) console.error(`\n${hint}`);
  console.error("");
  process.exit(1);
};

if (!uri) stop("MONGODB_URI is not set.");
if (process.env.NODE_ENV === "production") {
  stop("NODE_ENV is production.", "There is no override for this one.");
}

/**
 * Local or private-network hosts only — the same rule as reset-quiz.mjs.
 *
 * Not simply "must be localhost": a development database often lives on
 * another machine on the same LAN, and blocking that would make the guard
 * something people work around rather than trust. What it refuses is anything
 * reachable from the internet, and an Atlas `mongodb+srv://` connection, which
 * is never a scratch database.
 */
const host = (() => {
  try {
    return new URL(uri.replace(/^mongodb(\+srv)?:\/\//, "http://")).hostname;
  } catch {
    return "";
  }
})();

const isPrivate =
  host === "localhost" ||
  host === "::1" ||
  host.endsWith(".local") ||
  /^127\./.test(host) ||
  /^10\./.test(host) ||
  /^192\.168\./.test(host) ||
  /^172\.(1[6-9]|2\d|3[01])\./.test(host);

if (uri.startsWith("mongodb+srv://")) {
  stop(`"${host}" is a hosted cluster (mongodb+srv).`, "Point MONGODB_URI at a local database first.");
}
if (!isPrivate && process.env.ALLOW_DESTRUCTIVE_RESET !== "1") {
  stop(
    `"${host}" is not a local or private-network address.`,
    "If this really is a throwaway database, run it again with ALLOW_DESTRUCTIVE_RESET=1 — " +
      "and read the line above once more before you do."
  );
}
if (!isPrivate) {
  console.warn(`
ALLOW_DESTRUCTIVE_RESET is set — proceeding against "${host}".
`);
}

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: node scripts/reset-invoice.mjs <order no, e.g. PO-2026-0110>");
  console.error("       node scripts/reset-invoice.mjs --all");
  process.exit(1);
}

/* ------------------------------------------------------------------ */

const c = new MongoClient(uri);
await c.connect();
const db = c.db();

console.log(`database: ${host}/${db.databaseName}`);

const filter = arg === "--all" ? {} : { orderNo: arg.toUpperCase() };
const doomed = await db.collection("invoices").find(filter).toArray();

if (doomed.length === 0) {
  console.log(
    arg === "--all"
      ? "No invoices to remove — the next download will raise one."
      : `No invoice against ${arg}. It may not have been downloaded yet.`
  );
  await c.close();
  process.exit(0);
}

// Said out loud before it goes, so an accidental run on the wrong database is
// visible in the terminal rather than silent.
for (const inv of doomed) {
  console.log(
    `  removing ${inv.invoiceNo} · ${inv.orderNo} · ${inv.documentType ?? "?"} · ₹${inv.grandTotal}`
  );
}

const { deletedCount } = await db.collection("invoices").deleteMany(filter);
console.log(`\n${deletedCount} removed. The next download raises a fresh one.`);
console.log("  clinic:  http://localhost:3000/clinic/orders");
console.log("  admin:   http://localhost:3000/admin/inventory/orders");
await c.close();
