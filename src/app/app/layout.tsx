import { requireRole } from "@/lib/auth/guard";
import { requirePatientOnboarding } from "@/lib/auth/onboarding";

export default async function PatientAppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole("patient", "superadmin");
  // A patient record with no address cannot be booked against, so the whole
  // app waits behind one screen until it has one.
  await requirePatientOnboarding(session);
  return <>{children}</>;
}
