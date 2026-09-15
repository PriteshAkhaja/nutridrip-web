import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { adminNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { getBillingConfig, chargesGst } from "@/lib/billing/settings";
import { BillingForm } from "./BillingForm";

export const metadata: Metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const session = await requireRole("admin", "superadmin");
  const [nav, config] = await Promise.all([adminNav(), getBillingConfig()]);

  return (
    <ConsoleShell
      session={session}
      roleLabel="Pharmacist"
      nav={nav}
      activeHref="/admin/billing"
      breadcrumb={["Admin", "Billing"]}
      title="Billing"
      meta={chargesGst(config) ? "Tax invoices" : "Bills of supply"}
    >
      <p className="t-body text-[var(--color-ink-2)] max-w-[76ch] mb-6" style={{ textWrap: "pretty" }}>
        What a partner clinic downloads after their order is dispatched. These are registration
        details rather than copy, which is why they are here and not under Site copy — there is no
        sensible default for a GSTIN, and a made-up one printed on a real bill is a fabricated
        document.
      </p>

      <BillingForm config={config} />
    </ConsoleShell>
  );
}
