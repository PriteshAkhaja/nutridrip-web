import { requireRole } from "@/lib/auth/guard";

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  await requireRole("doctor", "superadmin");
  return <>{children}</>;
}
