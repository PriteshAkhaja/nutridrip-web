import Link from "next/link";
import { Pill } from "@/components/ui/Pill";
import { EmptyState } from "@/components/ui/States";
import type { BoardRow } from "@/lib/data/calls";
import { CALL_STATUS_LABEL, callWhen } from "@/lib/clinical/calls";
import { CallOutcome, HandOver } from "./CallActions";
import { getClockFormat } from "@/lib/settings/clock";
import { clock, dateIN, type ClockFormat } from "@/lib/time";

const minus15 = (iso: string, fmt: ClockFormat) => clock(new Date(iso).getTime() - 15 * 60_000, fmt);

/**
 * Calls, grouped by what they ask of the reader: the ones that need attention
 * (overdue, or no longer inside the physician's hours), today's, the week
 * ahead, and what was marked in the last day.
 */
export async function CallsBoard({
  rows,
  mode,
  doctors = [],
  canHandOver = false,
}: {
  rows: BoardRow[];
  /** A physician works their calls; the admin screen hands them over. */
  mode: "doctor" | "admin";
  doctors?: Array<{ id: string; name: string }>;
  canHandOver?: boolean;
}) {
  const clockFmt = await getClockFormat();
  const booked = rows.filter((r) => r.status === "booked");
  const attention = booked.filter((r) => r.overdue || r.clash);
  const today = booked.filter((r) => r.today && !r.overdue && !r.clash);
  const later = booked.filter((r) => !r.today && !r.overdue && !r.clash);
  const marked = rows.filter((r) => r.status !== "booked");

  if (rows.length === 0) {
    return (
      <EmptyState
        kind="cleared"
        title="No calls booked"
        body="Patients book a call when they finish the quiz. They appear here with the time, their number and their answers."
      />
    );
  }

  const group = (title: string, list: BoardRow[], note?: string) =>
    list.length === 0 ? null : (
      <section className="mb-8">
        <div className="flex items-baseline justify-between gap-4 mb-3 flex-wrap">
          <h2 className="t-h3">{title}</h2>
          <span className="t-data text-[13px] text-[var(--color-ink-3)]">
            {list.length} call{list.length === 1 ? "" : "s"}
            {note ? ` · ${note}` : ""}
          </span>
        </div>
        <div className="flex flex-col gap-3">
          {list.map((r) => (
            <div
              key={r.id}
              className="rounded-[var(--radius-lg)] border bg-[var(--color-surface)] p-5 grid gap-4 lg:grid-cols-[150px_1fr_auto] items-start"
              style={{ borderColor: r.overdue || r.clash ? "var(--color-caution)" : "var(--color-line)" }}
            >
              <div className="flex flex-col gap-1">
                <span className="t-data text-[18px]">{clock(r.startAt, clockFmt)}</span>
                <span className="t-small text-[var(--color-ink-3)]">
                  {dateIN(r.startAt, { weekday: "short", day: "numeric", year: undefined })} · {r.minutes} min
                </span>
              </div>

              <div className="min-w-0 flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={mode === "doctor" ? `/doctor/patients/${r.patientId}` : `/admin/users/${r.patientId}`}
                    className="t-h3 no-underline hover:no-underline"
                  >
                    {r.patientName}
                  </Link>
                  <span className="t-data text-[12.5px] text-[var(--color-ink-3)]">{r.callNo}</span>
                  {r.status !== "booked" && (
                    <Pill tone={r.status === "done" ? "safe" : "caution"}>{CALL_STATUS_LABEL[r.status]}</Pill>
                  )}
                  {r.overdue && (
                    <Pill tone="caution" dot>
                      Overdue
                    </Pill>
                  )}
                  {r.clash && <Pill tone="caution">{r.clash}</Pill>}
                </div>
                <span className="t-body">
                  <a href={`tel:${r.phone}`} className="t-data text-[14px]">
                    {r.phone}
                  </a>
                  {mode === "admin" && <span className="text-[var(--color-ink-2)]"> · with {r.doctorName}</span>}
                </span>
                <span className="t-small text-[var(--color-ink-2)]">
                  {r.held
                    ? `Held drip ${r.held.bookingNo} · ${callWhen(r.held.scheduledAt, clockFmt)}`
                    : "No drip held yet"}
                  {r.quizId && mode === "doctor" && (
                    <>
                      {" · "}
                      <Link href={`/doctor/review/${r.quizId}`}>Read the answers</Link>
                    </>
                  )}
                </span>
              </div>

              <div className="flex justify-end">
                {r.status !== "booked" ? (
                  r.quizId && mode === "doctor" ? (
                    <Link href={`/doctor/review/${r.quizId}`} className="t-body font-medium">
                      Decide
                    </Link>
                  ) : null
                ) : mode === "doctor" ? (
                  <CallOutcome id={r.id} due={r.due} opensAt={minus15(r.startAt, clockFmt)} />
                ) : canHandOver ? (
                  <HandOver id={r.id} doctors={doctors.filter((d) => d.id !== r.doctorId)} />
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    );

  return (
    <>
      {group("Needs attention", attention, "overdue, or outside the hours now")}
      {group("Today", today)}
      {group("Coming up", later, "next 7 days")}
      {group("Marked in the last day", marked)}
    </>
  );
}
