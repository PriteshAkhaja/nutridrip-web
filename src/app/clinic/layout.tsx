import { requireRole } from "@/lib/auth/guard";

export default async function ClinicLayout({ children }: { children: React.ReactNode }) {
  await requireRole("clinic", "superadmin");
  return <>{children}</>;
}
