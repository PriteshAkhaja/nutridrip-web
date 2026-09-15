import { z } from "zod";
import { connectDB } from "@/lib/db/mongoose";
import { AuditLog, HealthQuiz, LabReport, User } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { notify } from "@/lib/notify";
import { ok, fail, handleError } from "@/lib/api";

/** Kept small deliberately — the store is the database until object storage exists. */
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const CATEGORIES = ["Blood work", "Imaging", "Discharge summary", "Prescription", "Other"] as const;

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "labs.view")) return fail("Not permitted", 403);

    await connectDB();
    const patientId = new URL(req.url).searchParams.get("patientId");
    // A patient may only ever read their own.
    const filter =
      session!.role === "patient" ? { patientId: session!.sub } : patientId ? { patientId } : {};

    const reports = await LabReport.find(filter)
      .sort({ uploadedAt: -1 })
      .select("-fileUrl")
      .limit(200)
      .lean();
    return ok({ reports });
  } catch (err) {
    return handleError(err);
  }
}

const Upload = z.object({
  fileName: z.string().min(1).max(200),
  mimeType: z.string().refine((m) => ALLOWED.includes(m), "Upload a PDF or an image"),
  /** Data URL. Held in the record until object storage is wired up. */
  fileUrl: z.string().max(MAX_BYTES * 2),
  sizeBytes: z.number().int().min(1).max(MAX_BYTES),
  category: z.enum(CATEGORIES).default("Blood work"),
  notes: z.string().max(1000).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!can(session?.role, "labs.upload")) return fail("Only a patient uploads their own reports", 403);

    const input = Upload.parse(await req.json());
    if (input.sizeBytes > MAX_BYTES) {
      return fail(`That file is over ${MAX_BYTES / 1024 / 1024} MB. Compress it or photograph the pages.`, 413);
    }

    await connectDB();

    // Send it to whoever is reviewing, so a lab that was asked for gets seen.
    const quiz = await HealthQuiz.findOne({ patientId: session!.sub })
      .sort({ completedAt: -1 })
      .lean<{ reviewedBy?: unknown; reviewStatus: string } | null>();

    const report = await LabReport.create({
      ...input,
      patientId: session!.sub,
      sharedWithDoctorId: quiz?.reviewedBy,
      uploadedAt: new Date(),
    });

    const patient = await User.findById(session!.sub).lean<{ name: string } | null>();
    if (quiz?.reviewedBy) {
      await notify(
        String(quiz.reviewedBy),
        `New lab report · ${patient?.name ?? "a patient"}`,
        `${input.category} — ${input.fileName}`,
        "info",
        `/doctor/patients/${session!.sub}`
      );
    }

    await AuditLog.create({
      actorId: session!.sub,
      actorRole: session!.role,
      action: "lab.upload",
      entity: "LabReport",
      entityId: String(report._id),
      after: { fileName: input.fileName, category: input.category },
    });

    return ok({ id: String(report._id), fileName: report.fileName }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
