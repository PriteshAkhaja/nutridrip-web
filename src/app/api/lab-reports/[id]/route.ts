import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, LabReport } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { ok, fail, handleError } from "@/lib/api";

/** The file itself, returned only to people entitled to the record. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!can(session?.role, "labs.view")) return fail("Not permitted", 403);

    const { id } = await params;
    await connectDB();

    const report = await LabReport.findById(id).lean<{
      patientId: unknown;
      fileName: string;
      fileUrl?: string;
      mimeType?: string;
    } | null>();
    if (!report) return fail("Report not found", 404);
    if (session!.role === "patient" && String(report.patientId) !== session!.sub) {
      return fail("Not permitted", 403);
    }

    return ok({ fileName: report.fileName, mimeType: report.mimeType, fileUrl: report.fileUrl });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (session?.role !== "patient") return fail("Only the patient may remove their own report", 403);

    const { id } = await params;
    await connectDB();

    /**
     * Read it before removing it.
     *
     * This deletes a medical document, and the file goes with the row — a
     * trail entry saying only "a lab report was deleted" records that
     * something happened without recording what. The name, category and upload
     * date are kept so the deletion can be explained afterwards, which is the
     * whole reason the trail exists. The file body is never copied into it.
     */
    const report = await LabReport.findOne({ _id: id, patientId: session.sub }).lean<{
      fileName?: string;
      category?: string;
      uploadedAt?: Date;
      sharedWithDoctorId?: unknown;
    } | null>();
    if (!report) return fail("Report not found", 404);

    const res = await LabReport.deleteOne({ _id: id, patientId: session.sub });
    if (res.deletedCount === 0) return fail("Report not found", 404);

    await AuditLog.create({
      actorId: session.sub,
      actorRole: session.role,
      action: "lab.delete",
      entity: "LabReport",
      entityId: id,
      before: {
        fileName: report.fileName ?? "unnamed",
        category: report.category ?? "—",
        uploadedAt: report.uploadedAt,
        sharedWithPhysician: Boolean(report.sharedWithDoctorId),
      },
    });

    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
