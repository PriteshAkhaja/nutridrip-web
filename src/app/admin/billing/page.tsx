import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { adminNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { getBillingConfig, chargesGst, getLatePolicy, getPayee } from "@/lib/billing/settings";
import { PayeeForm } from "./PayeeForm";
import { BillingForm } from "./BillingForm";
import { LateChangesForm } from "./LateChangesForm";
import { recentLateCharges } from "@/lib/data/late-charges";
import { Card } from "@/components/ui/Card";
import { DataTable, THead, TR, TH, TD } from "@/components/ui/Table";
import { Pill } from "@/components/ui/Pill";
import { inr } from "@/lib/billing/late-policy";
import { formatDate, formatTime } from "@/lib/data/inventory";
import { getClockFormat } from "@/lib/settings/clock";
import { paymentsSetup } from "@/lib/payments/config";
import Link from "next/link";

export const metadata: Metadata = { title: "Billing" };
export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const clockFmt = await getClockFormat();
  const session = await requireRole("admin", "superadmin");
  const [nav, config, payee, policy, { rows: charges, owed }] = await Promise.all([
    adminNav(),
    getBillingConfig(),
    getPayee(),
    getLatePolicy(),
    recentLateCharges(),
  ]);

  return (
    <ConsoleShell
      session={session}
      roleLabel={session.role === "superadmin" ? "Super admin" : "Admin"}
      nav={nav}
      activeHref="/admin/billing"
      breadcrumb={["Admin", "Billing"]}
      title="Billing"
      meta={chargesGst(config) ? "Tax invoices" : "Bills of supply"}
    >
      <p className="t-body text-[var(--color-ink-2)] max-w-[76ch] mb-6" style={{ textWrap: "pretty" }}>
        What a partner clinic downloads after their order is dispatched. These are registration details rather than
        copy, which is why they are here and not under Site copy — there is no sensible default for a GSTIN, and a
        made-up one printed on a real bill is a fabricated document.
      </p>

      {/* ---------------- Online payment ---------------- */}
      {(() => {
        const setup = paymentsSetup();
        return (
          <Card
            padding="p-5"
            tone={setup.enabled ? (setup.mode === "live" ? "safe" : "info") : "caution"}
            className="mb-6"
          >
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex flex-col gap-1 max-w-[70ch]">
                <span className="t-body font-semibold">
                  Online payment ·{" "}
                  {setup.enabled ? (setup.mode === "live" ? "Razorpay, live" : "Razorpay, test mode") : "not set up"}
                </span>
                <span className="t-body text-[var(--color-ink-2)]">
                  {setup.enabled
                    ? "Patients pay to book and are refunded automatically when a session does not go ahead; clinics pay orders and invoices online."
                    : "Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to the server's environment and restart it to take payments online."}
                </span>
              </div>
              <Link href="/admin/payments" className="t-body font-semibold">
                Payments &rarr;
              </Link>
            </div>
          </Card>
        );
      })()}

      <BillingForm config={config} />

      {/* ---------------- Clinics: where they pay ---------------- */}
      <div id="payee" className="mt-8 scroll-mt-20">
        <PayeeForm payee={payee} />
      </div>

      {/* ---------------- Patients: late changes ---------------- */}
      <div id="late-changes" className="mt-8 flex flex-col gap-6 scroll-mt-20">
        <LateChangesForm policy={policy} />

        <Card padding="p-6">
          <h2 className="t-h3">Recent late-change fees</h2>
          <p className="t-body text-[var(--color-ink-2)] mt-1 max-w-[62ch]">
            Added to a session when a patient moved or cancelled it inside the window. No payment is taken in the app
            yet, so every fee stays unpaid until payments are added — then a fee the patient pays turns to paid.
          </p>
          <p className="t-data text-[13px] text-[var(--color-ink-2)] mt-2 mb-4">
            {owed.count === 0
              ? "Nothing owed"
              : `${inr(owed.amount)} unpaid across ${owed.count} fee${owed.count === 1 ? "" : "s"}`}
          </p>
          {charges.length === 0 ? (
            <p className="t-body text-[var(--color-ink-3)]">No late-change fees yet.</p>
          ) : (
            <DataTable>
              <THead>
                <TR>
                  <TH>When</TH>
                  <TH>Patient</TH>
                  <TH>Session</TH>
                  <TH>For</TH>
                  <TH numeric>Fee</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <tbody>
                {charges.map((c) => (
                  <TR key={`${c.bookingId}-${c.at}`}>
                    <TD mono nowrap>
                      {formatDate(c.at)} · {formatTime(c.at, clockFmt)}
                    </TD>
                    <TD nowrap>{c.patientName}</TD>
                    <TD mono nowrap>
                      {c.bookingNo}
                    </TD>
                    <TD>
                      <span className="t-body">{c.kind === "late_reschedule" ? "Moved late" : "Cancelled late"}</span>
                      {c.note ? <span className="t-small text-[var(--color-ink-2)] block">{c.note}</span> : null}
                    </TD>
                    <TD numeric>{inr(c.amount)}</TD>
                    <TD>
                      {/* Paid or waived only once payments exist to set it. */}
                      {c.settledAs === "paid" ? (
                        <Pill tone="safe" dot>
                          Paid
                        </Pill>
                      ) : c.settledAs === "waived" ? (
                        <Pill tone="neutral">Waived</Pill>
                      ) : (
                        <Pill tone="caution" dot>
                          Unpaid
                        </Pill>
                      )}
                    </TD>
                  </TR>
                ))}
              </tbody>
            </DataTable>
          )}
        </Card>
      </div>
    </ConsoleShell>
  );
}
