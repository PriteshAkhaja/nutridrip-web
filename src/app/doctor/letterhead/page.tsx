import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { doctorNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { Card } from "@/components/ui/Card";
import { connectDB } from "@/lib/db/mongoose";
import { TreatmentPlan, User } from "@/lib/models";
import { normaliseLetterhead } from "@/lib/clinical/letterhead";
import { LetterheadForm } from "./LetterheadForm";

export const metadata: Metadata = { title: "Letterhead" };
export const dynamic = "force-dynamic";

/**
 * The header a physician's own prescriptions carry.
 *
 * The doctor console admits a super admin too, but a super admin has no
 * physician record to put a letterhead on, and the API refuses them for the
 * same reason. They are told so here rather than bounced: a redirect from this
 * guard writes a refused-access row, and following a link in the nav is not an
 * attempt at anything.
 */
export default async function LetterheadPage() {
  const session = await requireRole("doctor", "superadmin");
  const nav = await doctorNav(session.sub);

  if (session.role !== "doctor") {
    return (
      <ConsoleShell
        session={session}
        roleLabel="Super admin"
        nav={nav}
        activeHref="/doctor/letterhead"
        breadcrumb={["Account", "Letterhead"]}
        title="Prescription letterhead"
      >
        <Card tone="muted" padding="p-6">
          <p className="t-body text-[var(--color-ink-2)] max-w-[62ch]" style={{ textWrap: "pretty" }}>
            A letterhead belongs to a physician: it is their identity on a document they answer for, so nobody edits
            it on their behalf. Sign in as the physician to set theirs.
          </p>
        </Card>
      </ConsoleShell>
    );
  }

  await connectDB();

  const [me, latest] = await Promise.all([
    User.findById(session.sub).select("name doctor").lean<{
      name: string;
      doctor?: {
        specialization?: string;
        licenseNo?: string;
        registrationCouncil?: string;
        letterhead?: unknown;
      };
    } | null>(),
    TreatmentPlan.findOne({ doctorId: session.sub }).sort({ createdAt: -1 }).select("_id").lean<{ _id: unknown } | null>(),
  ]);

  return (
    <ConsoleShell
      session={session}
      roleLabel="Physician"
      nav={nav}
      activeHref="/doctor/letterhead"
      breadcrumb={["Account", "Letterhead"]}
      title="Prescription letterhead"
    >
      <p className="t-body text-[var(--color-ink-2)] max-w-[76ch] mb-6" style={{ textWrap: "pretty" }}>
        What appears at the top of the prescriptions you issue. It is yours to word — a practice name, your
        qualifications, where patients can reach you. It changes how the slip looks; it does not change who is
        answerable for it.
      </p>

      <LetterheadForm
        initial={normaliseLetterhead(me?.doctor?.letterhead)}
        credentials={{
          name: me?.name ?? session.name,
          specialization: me?.doctor?.specialization ?? null,
          licenseNo: me?.doctor?.licenseNo ?? null,
          registrationCouncil: me?.doctor?.registrationCouncil ?? null,
        }}
        latestPlanId={latest ? String(latest._id) : null}
      />
    </ConsoleShell>
  );
}
