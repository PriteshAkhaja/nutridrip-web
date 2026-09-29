import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/guard";
import { MobileShell } from "@/components/layout/MobileShell";
import { connectDB } from "@/lib/db/mongoose";
import { Booking, Drip, User } from "@/lib/models";
import { FillColumn } from "@/components/ui/Fill";
import { ButtonLink } from "@/components/ui/Button";
import { ObservationLog } from "./ObservationLog";
import { formatTime } from "@/lib/data/inventory";
import { nurseOwns } from "@/lib/auth/ownership";
import { getClockFormat } from "@/lib/settings/clock";

export const metadata: Metadata = { title: "Infusion" };
export const dynamic = "force-dynamic";

/** When the bag will be empty at the current rate. */
function finishTime(remainingMl: number, rateMlHr: number): Date {
  return new Date(Date.now() + (remainingMl / rateMlHr) * 3_600_000);
}

function elapsed(from: Date): string {
  const ms = Date.now() - from.getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export default async function MonitorPage({ params }: { params: Promise<{ id: string }> }) {
  const clockFmt = await getClockFormat();
  const session = await requireRole("nurse", "superadmin");
  const { id } = await params;

  await connectDB();
  const booking = await Booking.findById(id).lean<{
    bookingNo: string;
    patientId: unknown;
    nurseId?: unknown;
    dripId: unknown;
    dripName?: string;
    startedAt?: Date;
    bagVolumeMl?: number;
    remainingMl?: number;
    rateMlHr?: number;
    observations: Array<{ at: Date; text: string }>;
  } | null>();
  if (!booking || !nurseOwns(session, booking)) notFound();

  const [patient, drip] = await Promise.all([
    User.findById(booking.patientId).lean<{ name: string } | null>(),
    Drip.findById(booking.dripId).lean<{
      ingredients: Array<{ name?: string; dose: number; unit: string; role: string }>;
    } | null>(),
  ]);

  const bag = booking.bagVolumeMl ?? 500;
  const remaining = booking.remainingMl ?? bag;
  const pct = bag > 0 ? (remaining / bag) * 100 : 0;
  const minutesLeft = booking.rateMlHr ? Math.round((remaining / booking.rateMlHr) * 60) : null;

  return (
    <MobileShell
      title="Infusion running"
      subtitle={
        <span className="t-data text-[13px]">
          {patient?.name} · {booking.dripName}
        </span>
      }
      back={{ href: `/nurse/session/${id}`, label: "Back to checklist" }}
      width="wide"
    >
      {/* Once the page has room: the bag and what is in it stay in view on the
          left while observations are logged on the right. */}
      <div className="@4xl:grid @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @6xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] @4xl:gap-6 @4xl:items-start">
        <div className="min-w-0 @4xl:sticky @4xl:top-24 @6xl:grid @6xl:grid-cols-2 @6xl:gap-4">
          {/* ---------------- The bag ---------------- */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 flex gap-6 items-center mb-4 @6xl:mb-0">
            <FillColumn pct={pct} ariaLabel={`${remaining} of ${bag} millilitres remaining`} />
            {/* Remaining leads on its own line; the rest two across once there is room. */}
            <div className="grid gap-x-6 gap-y-[10px] min-w-0 flex-1 @md:grid-cols-2">
              <div className="flex flex-col @md:col-span-2">
                <span className="t-micro">Remaining</span>
                <span className="t-data text-[22px] leading-[1.3]">{remaining} ml</span>
              </div>
              <div className="flex flex-col">
                <span className="t-micro">Rate</span>
                <span className="t-data text-[14.5px]">{booking.rateMlHr ?? "—"} ml/hr</span>
              </div>
              <div className="flex flex-col">
                <span className="t-micro">Elapsed</span>
                <span className="t-data text-[14.5px]">{booking.startedAt ? elapsed(booking.startedAt) : "—"}</span>
              </div>
              {minutesLeft !== null && (
                <div className="flex flex-col">
                  <span className="t-micro">Expected finish</span>
                  <span className="t-data text-[14.5px]">
                    {formatTime(finishTime(remaining, booking.rateMlHr!), clockFmt)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* ---------------- What is going in ---------------- */}
          {drip && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-4 @6xl:mb-0">
              <span className="t-micro">Approved components</span>
              <div className="flex flex-col gap-2 mt-3">
                {drip.ingredients
                  .filter((i) => i.role !== "FLUID")
                  .map((i, n) => (
                    <div key={n} className="flex justify-between gap-4 items-baseline">
                      <span className="t-body text-[var(--color-ink-2)]">{i.name}</span>
                      <span className="t-data text-[14.5px]">
                        {i.dose.toLocaleString("en-IN")} {i.unit}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
        <div className="min-w-0">
          <ObservationLog
            bookingId={id}
            rateMlHr={booking.rateMlHr ?? 140}
            remainingMl={remaining}
            observations={(booking.observations ?? []).map((o) => ({
              at: o.at.toISOString(),
              text: o.text,
            }))}
          />

          <div className="mt-5 flex flex-col @2xl:items-start">
            <ButtonLink
              href={`/nurse/session/${id}/adverse`}
              variant="danger"
              block
              size="lg"
              className="@2xl:w-auto @2xl:min-w-[280px]"
            >
              Report an adverse event
            </ButtonLink>
            <p className="t-small text-[var(--color-ink-3)] mt-2 text-center @2xl:text-left">
              Stops the infusion and escalates to the reviewing physician immediately.
            </p>
          </div>
        </div>
      </div>
    </MobileShell>
  );
}
