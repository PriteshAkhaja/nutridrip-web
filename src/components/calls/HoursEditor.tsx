"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Field";
import { DatePicker } from "@/components/ui/DatePicker";
import { TimePicker } from "@/components/ui/TimePicker";
import {
  CALL_LENGTHS,
  WEEKDAYS,
  callTimes,
  hoursProblem,
  hoursSummary,
  type DoctorHours,
  type HoursWindow,
} from "@/lib/clinical/calls";
import { useClockFormat } from "@/components/ClockProvider";

type Clash = { id: string; callNo: string; when: string; reason: string | null };

/** Monday first, as a week is read. */
const ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * A physician's call hours: windows per weekday, how long a call is, and days
 * off. Saved calls that no longer fit are listed after saving, to move or hand
 * over — never cancelled behind the patient's back.
 */
export function HoursEditor({
  doctorId,
  initial,
  initialClashes,
  today,
}: {
  doctorId: string;
  initial: DoctorHours | null;
  initialClashes: Clash[];
  /** "YYYY-MM-DD" in India, from the server, for the day-off picker's minimum. */
  today: string;
}) {
  const clockFmt = useClockFormat();
  const router = useRouter();
  const [weekly, setWeekly] = useState<HoursWindow[]>(initial?.weekly ?? []);
  const [callMinutes, setCallMinutes] = useState(initial?.callMinutes ?? 15);
  const [daysOff, setDaysOff] = useState<string[]>((initial?.daysOff ?? []).filter((d) => d >= today));
  const [newOff, setNewOff] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [clashes, setClashes] = useState<Clash[]>(initialClashes);

  const hours: DoctorHours = { weekly, callMinutes, daysOff };
  const problem = hoursProblem(hours);
  const change =
    <T,>(fn: (v: T) => void) =>
    (v: T) => {
      setSaved(false);
      fn(v);
    };

  const setWindow = (index: number, patch: Partial<HoursWindow>) =>
    change(setWeekly)(weekly.map((w, i) => (i === index ? { ...w, ...patch } : w)));

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/calls/hours/${doctorId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(hours),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not save the hours");
      else {
        setSaved(true);
        setClashes(json.data.clashes ?? []);
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. Nothing changed.");
    } finally {
      setBusy(false);
    }
  };

  // A typical Monday, to show what a patient will see.
  const sample = ORDER.map((d) => ({ d, n: weekly.filter((w) => w.day === d).length })).find((x) => x.n > 0)?.d;
  const sampleCalls =
    sample === undefined || problem ? 0 : callTimes({ ...hours, daysOff: [] }, sampleDate(sample)).length;

  return (
    <div className="flex flex-col gap-6">
      <Card padding="p-6">
        <h2 className="t-h3">Weekly hours</h2>
        <p className="t-body text-[var(--color-ink-2)] mt-1 mb-5 max-w-[64ch]">
          Patients can book a call inside these windows. A day with no window takes no calls.
        </p>
        <div className="flex flex-col divide-y divide-[var(--color-line)]">
          {ORDER.map((day) => {
            const mine = weekly.map((w, i) => ({ w, i })).filter((x) => x.w.day === day);
            return (
              <div key={day} className="py-3 grid gap-3 sm:grid-cols-[72px_1fr_auto] items-start">
                <span className="t-body font-semibold pt-[10px]">{WEEKDAYS[day]}</span>
                <div className="flex flex-col gap-2">
                  {mine.length === 0 && <span className="t-small text-[var(--color-ink-3)] pt-[12px]">No calls</span>}
                  {mine.map(({ w, i }) => (
                    // The pair stays on one line; on a phone Remove drops below it.
                    <div key={i} className="flex items-center gap-x-2 gap-y-1 flex-wrap">
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <div className="flex-1 min-w-0 sm:flex-none sm:w-[148px]">
                          <TimePicker
                            ariaLabel={`${WEEKDAYS[day]} from`}
                            value={w.start}
                            onChange={(v) => setWindow(i, { start: v })}
                            step={15}
                          />
                        </div>
                        <span className="t-small text-[var(--color-ink-3)] flex-none">to</span>
                        <div className="flex-1 min-w-0 sm:flex-none sm:w-[148px]">
                          <TimePicker
                            ariaLabel={`${WEEKDAYS[day]} until`}
                            value={w.end}
                            min={w.start || undefined}
                            onChange={(v) => setWindow(i, { end: v })}
                            step={15}
                          />
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => change(setWeekly)(weekly.filter((_, j) => j !== i))}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const last = mine[mine.length - 1]?.w;
                    change(setWeekly)([
                      ...weekly,
                      last
                        ? { day, start: last.end > "17:00" ? last.end : "17:00", end: "19:00" }
                        : { day, start: "10:00", end: "13:00" },
                    ]);
                  }}
                >
                  Add hours
                </Button>
              </div>
            );
          })}
        </div>
      </Card>

      <Card padding="p-6">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Select
              label="Length of a call"
              value={String(callMinutes)}
              onChange={(e) => change(setCallMinutes)(Number(e.target.value))}
            >
              {CALL_LENGTHS.map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </Select>
            {sampleCalls > 0 && sample !== undefined && (
              <span className="t-small text-[var(--color-ink-3)]">
                {sampleCalls} calls on a {WEEKDAYS[sample]}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="t-micro">Days off</span>
            <div className="flex gap-2 items-end flex-wrap">
              <div className="w-[190px]">
                <DatePicker ariaLabel="Add a day off" min={today} value={newOff} onChange={setNewOff} />
              </div>
              <Button
                variant="secondary"
                disabled={!newOff || daysOff.includes(newOff)}
                onClick={() => {
                  change(setDaysOff)([...daysOff, newOff].sort());
                  setNewOff("");
                }}
              >
                Add day off
              </Button>
            </div>
            {daysOff.length === 0 ? (
              <span className="t-small text-[var(--color-ink-3)]">None</span>
            ) : (
              <div className="flex gap-2 flex-wrap">
                {daysOff.map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => change(setDaysOff)(daysOff.filter((x) => x !== d))}
                    className="t-data text-[13px] rounded-full border border-[var(--color-line-2)] px-3 py-[6px] cursor-pointer bg-[var(--color-surface)]"
                    aria-label={`Remove day off ${d}`}
                  >
                    {d} ✕
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-4 flex-wrap">
        <Button loading={busy} disabled={Boolean(problem)} onClick={save}>
          Save hours
        </Button>
        {problem ? (
          <span className="t-small text-[var(--color-critical-text)]">{problem}</span>
        ) : saved ? (
          <span className="t-small text-[var(--color-safe-text)]">Saved · {hoursSummary(hours, clockFmt)}</span>
        ) : (
          <span className="t-small text-[var(--color-ink-3)]">{hoursSummary(hours, clockFmt)}</span>
        )}
      </div>
      {error && <span className="t-small text-[var(--color-critical-text)]">{error}</span>}

      {clashes.length > 0 && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-caution)] bg-[var(--color-caution-soft)] px-4 py-3">
          <span className="t-body font-semibold block mb-1">
            {clashes.length} booked call{clashes.length === 1 ? " no longer fits" : "s no longer fit"} these hours
          </span>
          <ul className="t-body text-[var(--color-ink-2)] list-disc pl-5">
            {clashes.map((c) => (
              <li key={c.id}>
                {c.callNo} · {c.when} · {c.reason}
              </li>
            ))}
          </ul>
          <span className="t-small text-[var(--color-ink-2)] block mt-2">
            They stay booked. Call the patient to move it, or ask the super admin to hand it to another physician.
          </span>
        </div>
      )}
    </div>
  );
}

/** A date that falls on the given weekday, for counting a typical day's calls. */
function sampleDate(day: number): string {
  // 2026-09-06 was a Sunday.
  const d = new Date(Date.UTC(2026, 8, 6 + day));
  return d.toISOString().slice(0, 10);
}
