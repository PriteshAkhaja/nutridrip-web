import { requireRole } from "@/lib/auth/guard";

/**
 * Everything under /admin is limited to the two platform roles. The rail and
 * header live in each page so the breadcrumb and title can be page-specific.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("superadmin", "admin");
  return <>{children}</>;
}
