/**
 * Put a patient's latest assessment back to "pending" so a review flow can be
 * walked again. Development only — it rewinds a physician's decision.
 *
 *   node scripts/reset-quiz.mjs 8585858585
 */
import { MongoClient } from "mongodb";
import "dotenv/config";

const phone = process.argv[2];
if (!phone) {
  console.error("Usage: node scripts/reset-quiz.mjs <patient phone, e.g. 8585858585>");
  process.exit(1);
}

const c = new MongoClient(process.env.MONGODB_URI);
await c.connect();
const db = c.db();

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

await db.collection("healthquizzes").updateOne(
  { _id: quiz._id },
  {
    $set: { reviewStatus: "pending" },
    $unset: {
      reviewedBy: "", reviewedAt: "", doctorNotes: "", patientNote: "",
      recommendedDripIds: "", recommendationStrength: "",
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
