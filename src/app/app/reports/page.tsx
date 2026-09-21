import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { MobileShell } from "@/components/layout/MobileShell";
import { connectDB } from "@/lib/db/mongoose";
import { LabReport } from "@/lib/models";
import { EmptyState } from "@/components/ui/States";
import { formatDate } from "@/lib/data/inventory";
import { PagedResults, PagedView, Pagination } from "@/components/ui/Paged";
import { paginate } from "@/lib/pagination-db";
import { parsePaging } from "@/lib/pagination";
import { UploadReport } from "./UploadReport";
import { ReportRow } from "./ReportRow";
import { PATIENT_TABS } from "../tabs";

export const metadata: Metadata = { title: "Lab reports" };
export const dynamic = "force-dynamic";

const kb = (bytes?: number) => (bytes ? `${Math.round(bytes / 1024)} KB` : "—");

export default async function LabReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  const session = await requireRole("patient", "superadmin");
  const { page, pageSize } = await searchParams;
  await connectDB();

  // One page from the database. The report file itself is not part of the list:
  // only the fields a row shows are selected.
  const { rows: reports, meta } = await paginate<{
    _id: unknown;
    fileName: string;
    category?: string;
    notes?: string;
    sizeBytes?: number;
    uploadedAt: Date;
  }>(LabReport, { patientId: session.sub }, {
    sort: { uploadedAt: -1 },
    paging: parsePaging({ page, pageSize }),
    select: "fileName category notes sizeBytes uploadedAt",
  });

  return (
    <MobileShell
      title="Lab reports"
      subtitle={`${meta.total} on file`}
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

      {meta.total === 0 ? (
        <EmptyState
          kind="first-run"
          title="Nothing uploaded yet"
          body="Upload a recent blood panel and the physician reviewing your quiz will see it alongside your answers."
        />
      ) : (
        <PagedView>
        <PagedResults>
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
        </PagedResults>
        <Pagination meta={meta} basePath="/app/reports" params={{ pageSize }} nouns={["report", "reports"]} />
        </PagedView>
      )}

      <p className="t-small text-[var(--color-ink-3)] mt-6">
        Anything you upload is visible to you and to the physician reviewing your protocol. Nobody else.
      </p>
    </MobileShell>
  );
}
