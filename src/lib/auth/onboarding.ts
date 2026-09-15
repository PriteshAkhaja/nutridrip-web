import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/models";
import type { SessionPayload } from "./session";

/**
 * A patient signs in with nothing but a phone number, so the account that
 * exists a second later has no address on it. Every clinical path then dead-ends:
 * the booking guard needs a pincode to answer whether we serve the area at all,
 * `pickNurse()` needs it to dispatch anyone, and the nurse needs a street to
 * drive to. Asking once, at the start, is kinder than refusing at checkout.
 *
 * The placeholder name matters for the same reason: step ps-02 of the checklist
 * is the nurse verifying identity by name, and "New patient" verifies nobody.
 */

/** What `POST /api/auth/otp/verify` names an account before the patient does. */
export const PLACEHOLDER_NAME = "New patient";

export type OnboardingState = {
  complete: boolean;
  /** Field keys still outstanding, for the form to highlight. */
  missing: Array<"name" | "address" | "city" | "pincode">;
};

type PatientRecord = {
  name?: string;
  patient?: { address?: string; city?: string; pincode?: string };
} | null;

export function onboardingOf(me: PatientRecord): OnboardingState {
  const p = me?.patient ?? {};
  const missing: OnboardingState["missing"] = [];

  const name = (me?.name ?? "").trim();
  if (!name || name === PLACEHOLDER_NAME) missing.push("name");
  if (!(p.address ?? "").trim()) missing.push("address");
  if (!(p.city ?? "").trim()) missing.push("city");
  // Six digits, because that is what zoneForPincode() can actually match.
  if (!/^\d{6}$/.test(p.pincode ?? "")) missing.push("pincode");

  return { complete: missing.length === 0, missing };
}

export async function patientOnboarding(userId: string): Promise<OnboardingState> {
  await connectDB();
  const me = await User.findById(userId).select("name patient").lean<PatientRecord>();
  return onboardingOf(me);
}

/**
 * Send a patient who has not finished onboarding to the one screen that can
 * finish it. Staff pass straight through — a super admin opening the patient
 * app to look at something is not onboarding.
 *
 * This is a routing gate, not a security control: the hard refusals still live
 * server-side in the booking route, which will not accept a session without a
 * served pincode no matter how the request arrives.
 */
export async function requirePatientOnboarding(session: SessionPayload): Promise<void> {
  if (session.role !== "patient") return;
  const state = await patientOnboarding(session.sub);
  if (!state.complete) redirect("/welcome");
}
