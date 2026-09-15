import { connectDB } from "@/lib/db/mongoose";
import { LabReport } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { fail, handleError } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Only what a browser will render inline; anything else is sent as a download. */
const INLINE = ["application/pdf", "image/png", "image/jpeg", "image/webp", "image/heic"];

/**
 * The report itself, as bytes.
 *
 * The sibling route hands back the whole data URL inside JSON, which means a
 * 1 MB scan travels as 1.4 MB of base64 that the browser then has to decode
 * before anyone can look at it. This returns the file, so a physician can open
 * a patient's blood work with a plain link — which is what they were missing:
 * their screens listed the file names and gave them no way to read them.
 *
 * Files live in the record until object storage is wired up, so this is the
 * one place that knows they are data URLs. When that changes, only this
 * redirects somewhere else.
 */
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

    // A patient may only ever open their own. Staff with labs.view may open
    // any, which is the same rule the JSON route has always applied.
    if (session!.role === "patient" && String(report.patientId) !== session!.sub) {
      return fail("Not permitted", 403);
    }

    const url = report.fileUrl ?? "";
    const comma = url.indexOf(",");
    if (!url.startsWith("data:") || comma === -1) {
      // Seeded rows carry a name and no file. Saying so is better than a
      // browser tab full of nothing.
      return fail("That report has no file attached", 404);
    }

    const bytes = Buffer.from(url.slice(comma + 1), "base64");
    const type = report.mimeType || url.slice(5, url.indexOf(";")) || "application/octet-stream";

    // The filename is quoted and stripped of quotes and newlines: it comes from
    // whatever the patient's device called the file, and it lands in a header.
    const safeName = report.fileName.replace(/["\r\n]/g, "").slice(0, 200) || "report";

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": type,
        "Content-Length": String(bytes.length),
        "Content-Disposition": `${INLINE.includes(type) ? "inline" : "attachment"}; filename="${safeName}"`,
        // Somebody else's medical record must never sit in a shared cache.
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
