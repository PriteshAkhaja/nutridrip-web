import { connectDB } from "@/lib/db/mongoose";
import { AuditLog } from "@/lib/models";
import { getSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { fail, handleError } from "@/lib/api";
import { csvRow, CSV_BOM } from "@/lib/data/csv";
import {
  actionLabel,
  auditRange,
  describeChange,
  entityLabel,
  groupFilter,
  groupFor,
  toDay,
  AUDIT_GROUPS,
  type AuditGroup,
} from "@/lib/data/audit";
import { nameEntities, nameKey } from "@/lib/data/audit-names";
import { formatDate, formatTime } from "@/lib/data/inventory";

/**
 * The audit trail as a CSV, for the compliance review that happens outside
 * this app.
 *
 * Three decisions worth knowing:
 *
 * **It exports the filter, not the page.** Somebody narrows to a window and a
 * person, then downloads exactly that. Exporting the visible fifty rows would
 * be useless; exporting everything regardless of the filter would be a
 * different kind of useless.
 *
 * **It streams.** `record.opened` writes a row per read and is deliberately
 * not deduplicated, so this table grows without bound. Building the whole file
 * in memory would work today at a thousand rows and take the server down at a
 * million. Rows are pulled from a cursor in batches, turned into lines, and
 * pushed out as they go.
 *
 * **The export is itself audited.** Downloading the entire trail is precisely
 * the kind of act the trail exists to record, and the row is written before a
 * single byte is sent — an export abandoned halfway still happened.
 */

/** Rows per round trip: enough to make name lookups worthwhile, small enough to stay cheap. */
const BATCH = 500;

type Row = {
  _id: unknown;
  actorId?: unknown;
  actorRole?: string;
  action: string;
  entity?: string;
  entityId?: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  ip?: string;
  at: Date;
};

const HEADERS = [
  "Timestamp (UTC)",
  "Date",
  "Time",
  "Who",
  "Role",
  "Group",
  "Action",
  "Action code",
  "Record",
  "Which one",
  "Record id",
  "From (IP)",
  "What changed",
];

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session) return fail("Unauthorized", 401);
    // The redirecting guards belong to server components; a handler answers.
    if (!can(session.role, "audit.view")) return fail("Not allowed", 403);

    await connectDB();

    const params = new URL(req.url).searchParams;
    const group = params.get("group") ?? undefined;
    const action = params.get("action") ?? undefined;
    const actor = params.get("actor") ?? undefined;
    const from = params.get("from") ?? undefined;
    const to = params.get("to") ?? undefined;

    // The same filter the page builds, so the file matches what was on screen.
    const range = auditRange(from, to);
    const activeGroup = AUDIT_GROUPS.includes(group as AuditGroup) ? (group as AuditGroup) : null;
    const filter: Record<string, unknown> = {
      ...(range ? { at: range } : {}),
      ...(action ? { action } : activeGroup ? { action: groupFilter(activeGroup) } : {}),
      ...(actor ? { actorId: actor } : {}),
    };

    const total = await AuditLog.countDocuments(filter);

    // Written before a byte is sent: an export abandoned halfway still
    // happened, and if this throws the export fails rather than going
    // unrecorded.
    //
    // The file will hold one row more than `rowsAtRequest` — this very row,
    // created between the count and the read. That is not an off-by-one to
    // fix: an auditor downloading the trail should see the download in it.
    await AuditLog.create({
      actorId: session.sub,
      actorRole: session.role,
      action: "audit.export",
      entity: "AuditLog",
      after: {
        rowsAtRequest: total,
        ...(activeGroup ? { group: activeGroup } : {}),
        ...(action ? { action } : {}),
        ...(actor ? { actor } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
        filtered: Boolean(range || activeGroup || action || actor),
      },
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined,
    });

    const cursor = AuditLog.find(filter)
      .sort({ at: -1, _id: -1 })
      .batchSize(BATCH)
      .lean<Row[]>()
      .cursor();

    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(encoder.encode(CSV_BOM + csvRow(HEADERS)));

        let batch: Row[] = [];

        const flush = async () => {
          if (batch.length === 0) return;
          // One name lookup per batch rather than per row — the same resolver
          // the screen uses, so the file and the page agree.
          const names = await nameEntities(
            batch,
            batch.map((r) => (r.actorId ? String(r.actorId) : null))
          );

          let chunk = "";
          for (const r of batch) {
            const who = r.actorId
              ? (names.get(nameKey("User", String(r.actorId))) ??
                `Deleted account ${String(r.actorId)}`)
              : "System";
            const which =
              r.entity && r.entityId ? (names.get(nameKey(r.entity, r.entityId)) ?? "") : "";
            const changed = describeChange(r.before, r.after)
              .map((c) =>
                c.from !== undefined && c.to !== undefined
                  ? `${c.field}: ${c.from} -> ${c.to}`
                  : `${c.field}: ${c.to ?? c.from}`
              )
              .join("; ");

            chunk += csvRow([
              r.at,
              formatDate(r.at),
              formatTime(r.at),
              who,
              r.actorRole ?? "",
              groupFor(r.action),
              actionLabel(r.action),
              r.action,
              r.entity ? entityLabel(r.entity) : "",
              which,
              r.entityId ?? "",
              r.ip ?? "",
              changed,
            ]);
          }
          controller.enqueue(encoder.encode(chunk));
          batch = [];
        };

        try {
          for await (const row of cursor) {
            batch.push(row as Row);
            if (batch.length >= BATCH) await flush();
          }
          await flush();
          controller.close();
        } catch (err) {
          // The file is already part-sent, so there is no status code left to
          // change. Say so inside the file rather than truncating silently —
          // a short export that looks complete is worse than one that admits
          // it is not.
          console.error("audit export failed mid-stream:", err);
          controller.enqueue(
            encoder.encode(csvRow(["EXPORT INCOMPLETE — this file stops early, do not rely on it"]))
          );
          controller.close();
        } finally {
          await cursor.close().catch(() => {});
        }
      },
    });

    const name = `nutridrip-audit-${range && from ? `${from}_${to || toDay(new Date())}` : toDay(new Date())}.csv`;

    return new Response(stream, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${name}"`,
        // A trail is read once and changes constantly; a cached copy would be
        // a stale record presented as a current one.
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
