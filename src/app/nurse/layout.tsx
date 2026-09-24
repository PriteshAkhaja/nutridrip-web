import { requireRole } from "@/lib/auth/guard";
import { SyncStatus } from "@/components/layout/SyncStatus";
import { NavTrail } from "@/components/layout/NavTrail";

export default async function NurseLayout({ children }: { children: React.ReactNode }) {
  await requireRole("nurse", "superadmin");
  return (
    <>
      <SyncStatus />
      <NavTrail />
      {children}
    </>
  );
}
