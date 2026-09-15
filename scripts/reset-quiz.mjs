/**
 * Put a patient's latest assessment back to "pending" so a review flow can be
 * walked again.
 *
 *   node scripts/reset-quiz.mjs 8585858585
 *
 * DEVELOPMENT ONLY. This erases a physician's recorded decision — who approved
 * a protocol, when, what they prescribed and what they wrote to the patient —
 * and leaves nothing behind to say it ever existed. That record is the kind of
 * thing you have to be able to produce afterwards, so the guard below refuses
 * to run anywhere that might not be a development database.
 */
import { MongoClient } from "mongodb";
import "dotenv/config";

/* ------------------------------------------------------------------ */
/* Guard                                                               */
/* ------------------------------------------------------------------ */

const uri = process.env.MONGODB_URI ?? "";

const stop = (why, hint) => {
  console.error(`\nRefusing to run — ${why}`);
  console.error("This erases a physician's recorded decision on an assessment.");
  if (hint) console.error(`\n${hint}`);
  console.error("");
  process.exit(1);
};

if (!uri) stop("MONGODB_URI is not set.");
if (process.env.NODE_ENV === "production") {
  stop("NODE_ENV is production.", "There is no override for this one.");
}

/**
 * Local or private-network hosts only.
 *
 * Not simply "must be localhost": a development database often lives on
 * another machine on the same LAN, and blocking that would make the guard
 * something people work around rather than trust. What it does refuse is
 * anything reachable from the internet — a cloud host, or an Atlas
 * `mongodb+srv://` connection, which is never a scratch database.
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
// The one way past, for a development database that genuinely lives on a
// public host. Deliberately an environment variable and not a flag: it has to
// be typed on purpose, and it will not survive being copied out of somebody's
// shell history into a deploy script without being noticed.
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

const phone = process.argv[2];
if (!phone) {
  console.error("Usage: node scripts/reset-quiz.mjs <patient phone, e.g. 8585858585>");
  process.exit(1);
}

/* ------------------------------------------------------------------ */

const c = new MongoClient(uri);
await c.connect();
const db = c.db();

console.log(`database: ${host}/${db.databaseName}`);

const digits = phone.replace(/\D/g, "").slice(-10);
const patient = await db.collection("users").findOne({ role: "patient", phone: { $regex: digits + "$" } });
if (!patient) {
  console.error(`No patient with a phone ending ${digits}`);
  process.exit(1);
}

const quiz = await db.collection("healthquizzes").find({ patientId: patient._id }).sort({ completedAt: -1 }).limit(1).next();
if (!quiz) {
  console.error(`${patient.name} has no assessment yet — take the quiz first.`);
  process.exit(1);
}

// Said out loud before it goes, so an accidental run on the wrong database is
// visible in the terminal rather than silent.
if (quiz.reviewStatus !== "pending") {
  console.log(`erasing the decision on ${String(quiz._id)}: ${quiz.reviewStatus}${quiz.reviewedAt ? ` on ${new Date(quiz.reviewedAt).toISOString().slice(0, 10)}` : ""}`);
}

await db.collection("healthquizzes").updateOne(
  { _id: quiz._id },
  {
    $set: { reviewStatus: "pending" },
    $unset: {
      reviewedBy: "", reviewedAt: "", doctorNotes: "", patientNote: "",
      declineReason: "", recommendedDripIds: "", recommendationStrength: "",
      infoRequest: "", infoAnswer: "", infoAnsweredAt: "",
    },
  }
);

// A booking behind it, held, so "ask for more information" has something to hold.
const booking = await db.collection("bookings").findOne({ patientId: patient._id, status: { $in: ["awaiting_review", "approved", "nurse_assigned"] } });
if (booking) {
  await db.collection("bookings").updateOne(
    { _id: booking._id },
    { $set: { status: "awaiting_review" }, $unset: { nurseId: "", doctorId: "", approvedAt: "", approvalNotes: "" } }
  );
}

console.log(`${patient.name}: assessment ${String(quiz._id)} is pending again`);
console.log(`  physician:  http://localhost:3000/doctor/review/${String(quiz._id)}`);
console.log(`  patient:    http://localhost:3000/app/results/${String(quiz._id)}`);
if (booking) console.log(`  booking ${booking.bookingNo} put back to awaiting_review`);
await c.close();
