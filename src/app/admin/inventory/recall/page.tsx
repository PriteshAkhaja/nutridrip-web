import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { adminNav } from "@/lib/nav";
import { ConsoleShell } from "@/components/layout/ConsoleShell";
import { connectDB } from "@/lib/db/mongoose";
import { Booking } from "@/lib/models";
import { listLots, formatDate, formatTime } from "@/lib/data/inventory";
import { traceBatch } from "@/lib/inventory/alerts";
import { DataTable, THead, TH, TR, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/States";
import { Card } from "@/components/ui/Card";
import { RecallPicker } from "./Picker";

export const metadata: Metadata = { title: "Recall trace" };
export const dynamic = "force-dynamic";

export default async function RecallPage({
  searchParams,
}: {
  searchParams: Promise<{ batch?: string }>;
}) {
  const session = await requireRole("superadmin", "admin");
  const nav = await adminNav();
  const { batch } = await searchParams;

  await connectDB();
  const lots = await listLots();
  const selected = lots.find((l) => l.batchNo === batch);

  // The consumption ledger is the trail: which batch fed which order, and
  // through that order, which patient received it. traceBatch is that query —
  // used here rather than repeated, so the trail cannot come out differently
  // on this screen than anywhere else that asks the same question.
  const rows = selected ? await traceBatch(selected.id) : [];

  // Sessions that used the batch directly, recorded on the booking itself.
  const sessions = selected
    ? await Booking.find({ "componentsGiven.batchNo": selected.batchNo }).lean<
        Array<{ _id: unknown; bookingNo: string; dripName?: string; completedAt?: Date; patientId: unknown }>
      >()
    : [];

  const totalUnits = rows.reduce((s, r) => s + r.unitsConsumed, 0);

  return (
    <ConsoleShell
      session={session}
      roleLabel={session.role === "superadmin" ? "Super admin" : "Admin"}
      nav={nav}
      activeHref="/admin/inventory/recall"
      breadcrumb={["Inventory", "Recall trace"]}
      title="Recall trace"
      meta={selected ? `Batch ${selected.batchNo}` : "Select a batch"}
    >
      <p className="t-body text-[var(--color-ink-2)] max-w-[76ch] mb-6" style={{ textWrap: "pretty" }}>
        Every dispatch writes an immutable row recording which batch fed which order. Pick a batch and the trail
        below shows everywhere it went — this is what a recall notice is answered with.
      </p>

      <RecallPicker
        lots={lots.map((l) => ({
          batchNo: l.batchNo,
          drugName: l.drugName,
          expiry: l.expiry,
          qtyOnHand: l.qtyOnHand,
        }))}
        selected={batch ?? ""}
      />

      {!selected ? (
        <div className="mt-6">
          <EmptyState
            kind="first-run"
            title="No batch selected"
            body="Choose a batch above. If it has ever been dispatched, every order and session it touched is listed here."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 min-[1760px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start mt-6">
          {/* Side by side only from 1760px. Below that the table takes the full width and this panel sits under it: with names and dates held on one line, the table does not fit beside the panel on a laptop or a 1536-1680px monitor (measured; the orders list beside its 400px composer needs about 1740px). */}
          <div className="flex flex-col gap-6">
            <section>
              <h2 className="t-h3 mb-3">Orders this batch fed</h2>
              {rows.length === 0 ? (
                <EmptyState
                  kind="cleared"
                  title="Never dispatched"
                  body={`Batch ${selected.batchNo} has not left the shelf. Nothing to recall — quarantining it is enough.`}
                />
              ) : (
                <DataTable>
                  <THead>
                    <TR>
                      <TH>Order</TH>
                      <TH>Patient reference</TH>
                      <TH>Dispatched</TH>
                      <TH numeric>Units</TH>
                      <TH numeric>Active used</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {rows.map((r) => (
                      <TR key={r.id}>
                        <TD mono nowrap>{r.orderNo}</TD>
                        <TD nowrap>
                          <span className="t-data text-[13px]">{r.patientRef}</span>
                        </TD>
                        <TD mono nowrap>
                          {r.dispatchedAt
                            ? `${formatDate(r.dispatchedAt)} · ${formatTime(r.dispatchedAt)}`
                            : "—"}
                        </TD>
                        <TD numeric>{r.unitsConsumed}</TD>
                        <TD numeric nowrap>
                          {r.activeUsed.toLocaleString("en-IN")} {r.contentUnit ?? ""}
                        </TD>
                      </TR>
                    ))}
                  </tbody>
                </DataTable>
              )}
            </section>

            {sessions.length > 0 && (
              <section>
                <h2 className="t-h3 mb-3">Sessions that recorded this batch</h2>
                <DataTable>
                  <THead>
                    <TR>
                      <TH>Session</TH>
                      <TH>Drip</TH>
                      <TH>Completed</TH>
                    </TR>
                  </THead>
                  <tbody>
                    {sessions.map((s) => (
                      <TR key={String(s._id)}>
                        <TD mono nowrap>{s.bookingNo}</TD>
                        <TD nowrap>{s.dripName ?? "—"}</TD>
                        <TD mono nowrap>{s.completedAt ? formatDate(s.completedAt) : "—"}</TD>
                      </TR>
                    ))}
                  </tbody>
                </DataTable>
              </section>
            )}
          </div>

          <Card padding="p-5">
            <span className="t-micro">Batch</span>
            <h3 className="t-h3 mt-2 mb-4">{selected.batchNo}</h3>
            <div className="flex flex-col gap-2">
              {[
                ["Drug", selected.drugName],
                ["Brand", selected.brandName],
                ["Manufacturer", selected.manufacturer ?? "—"],
                ["Expiry", formatDate(selected.expiry)],
                ["Content", `${selected.contentValue.toLocaleString("en-IN")} ${selected.contentUnit}`],
                ["Received", String(selected.qtyReceived)],
                ["On hand", String(selected.qtyOnHand)],
                ["Dispatched", String(totalUnits)],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4 items-baseline">
                  <span className="t-body text-[var(--color-ink-2)]">{k}</span>
                  <span className="t-data text-[14.5px] text-right">{v}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </ConsoleShell>
  );
}
