import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { MobileShell } from "@/components/layout/MobileShell";
import { connectDB } from "@/lib/db/mongoose";
import { LabReport } from "@/lib/models";
import { EmptyState } from "@/components/ui/States";
import { formatDate } from "@/lib/data/inventory";
import { UploadReport } from "./UploadReport";
import { ReportRow } from "./ReportRow";
import { PATIENT_TABS } from "../tabs";

export const metadata: Metadata = { title: "Lab reports" };
export const dynamic = "force-dynamic";

const kb = (bytes?: number) => (bytes ? `${Math.round(bytes / 1024)} KB` : "—");

export default async function LabReportsPage() {
  const session = await requireRole("patient", "superadmin");
  await connectDB();

  const reports = await LabReport.find({ patientId: session.sub })
    .sort({ uploadedAt: -1 })
    .lean<
      Array<{
        _id: unknown;
        fileName: string;
        category?: string;
        notes?: string;
        sizeBytes?: number;
        uploadedAt: Date;
      }>
    >();

  return (
    <MobileShell
      title="Lab reports"
      subtitle={`${reports.length} on file`}
      tabs={PATIENT_TABS}
      activeHref="/app/reports"
    >
      <p className="t-body text-[var(--color-ink-2)] mb-5">
        Some protocols need recent bloods before a physician will approve them — Iron Restore always does. Anything
        you upload here is visible to the reviewing physician.
      </p>

      <div className="mb-5">
        <UploadReport />
      </div>

      {reports.length === 0 ? (
        <EmptyState
          kind="first-run"
          title="Nothing uploaded yet"
          body="Upload a recent blood panel and the physician reviewing your quiz will see it alongside your answers."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {reports.map((r) => (
            <ReportRow
              key={String(r._id)}
              id={String(r._id)}
              fileName={r.fileName}
              category={r.category ?? "Uncategorised"}
              sizeLabel={kb(r.sizeBytes)}
              dateLabel={formatDate(r.uploadedAt)}
              notes={r.notes}
            />
          ))}
        </div>
      )}

      <p className="t-small text-[var(--color-ink-3)] mt-6">
        Anything you upload is visible to you and to the physician reviewing your protocol. Nobody else.
      </p>
    </MobileShell>
  );
}
