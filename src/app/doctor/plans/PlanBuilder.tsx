"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, Checkbox } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import { DripPicker } from "@/components/ui/DripPicker";

type Opt = { id: string; name: string; city?: string };
/** A drip carries what it contains, so the physician can search by ingredient. */
type DripOpt = Opt & { category?: string; keywords?: Array<string | undefined> };
type PlanSession = { week: number; date: string; dripId: string; dripName: string; notes: string };

/**
 * A course is written as a grid of weeks. Components are copied from the drip
 * on save, so the plan records exactly what the recipe said at the time it was
 * written rather than pointing at a recipe that may later change.
 */
export function PlanBuilder({
  patients,
  nurses,
  drips,
}: {
  patients: Opt[];
  nurses: Opt[];
  drips: DripOpt[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [patientId, setPatientId] = useState(patients[0]?.id ?? "");
  const [diagnosis, setDiagnosis] = useState("");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [totalWeeks, setTotalWeeks] = useState(4);
  const [perWeek, setPerWeek] = useState(1);
  const [dripId, setDripId] = useState(drips[0]?.id ?? "");
  const [nurseId, setNurseId] = useState("");
  const [share, setShare] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** One row per session, laid out from the start date at weekly intervals. */
  const buildSessions = (): PlanSession[] => {
    const out: PlanSession[] = [];
    const drip = drips.find((d) => d.id === dripId);
    const start = new Date(startDate);
    for (let w = 1; w <= totalWeeks; w++) {
      for (let n = 0; n < perWeek; n++) {
        const d = new Date(start);
        d.setDate(start.getDate() + (w - 1) * 7 + n * 3);
        out.push({
          week: w,
          date: d.toISOString(),
          dripId,
          dripName: drip?.name ?? "",
          notes: "",
        });
      }
    }
    return out;
  };

  const sessions = buildSessions();

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const byWeek = new Map<number, PlanSession[]>();
      for (const s of sessions) byWeek.set(s.week, [...(byWeek.get(s.week) ?? []), s]);

      const res = await fetch("/api/plans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          patientId,
          diagnosis: diagnosis || undefined,
          startDate: new Date(startDate).toISOString(),
          totalWeeks,
          nurseId: nurseId || undefined,
          sharedWithNurse: share && Boolean(nurseId),
          weeks: [...byWeek].map(([weekNum, list]) => ({
            weekNum,
            sessions: list.map((s) => ({
              date: s.date,
              dripId: s.dripId,
              dripName: s.dripName,
              components: [],
              sessionNotes: s.notes || undefined,
            })),
          })),
        }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not write that plan");
      else {
        setOpen(false);
        setDiagnosis("");
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. Nothing was written.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} disabled={patients.length === 0 || drips.length === 0}>
        Write a plan
      </Button>
    );
  }

  return (
    <Card padding="p-6">
      <div className="flex items-baseline justify-between gap-4 mb-5">
        <h2 className="t-h3">Write a treatment plan</h2>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Select label="Patient" value={patientId} onChange={(e) => setPatientId(e.target.value)}>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.city ? ` — ${p.city}` : ""}
            </option>
          ))}
        </Select>
        <DripPicker
          label="Drip"
          value={dripId}
          onChange={setDripId}
          options={drips.map((d) => ({
            id: d.id,
            name: d.name,
            category: d.category,
            keywords: d.keywords,
          }))}
        />
      </div>

      <div className="mt-4">
        <Textarea
          label="Diagnosis or primary concern"
          rows={2}
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          placeholder="Persistent fatigue with borderline B12 and magnesium markers"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mt-4">
        <Input
          label="Starts"
          type="date"
          mono
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <Input
          label="Weeks"
          type="number"
          min={1}
          max={52}
          mono
          value={totalWeeks}
          onChange={(e) => setTotalWeeks(Math.max(1, Math.min(52, Number(e.target.value) || 1)))}
        />
        <Input
          label="Sessions per week"
          type="number"
          min={1}
          max={5}
          mono
          value={perWeek}
          onChange={(e) => setPerWeek(Math.max(1, Math.min(5, Number(e.target.value) || 1)))}
        />
      </div>

      <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-2)] p-4 mt-5">
        <span className="t-micro block mb-3">
          {sessions.length} session{sessions.length === 1 ? "" : "s"} will be written
        </span>
        <div className="flex flex-wrap gap-2">
          {sessions.slice(0, 12).map((s, i) => (
            <span
              key={i}
              className="t-data text-[13px] px-[10px] py-1 rounded-full border border-[var(--color-line-2)] bg-[var(--color-surface)]"
            >
              W{s.week} ·{" "}
              {new Date(s.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
            </span>
          ))}
          {sessions.length > 12 && (
            <span className="t-small text-[var(--color-ink-3)] self-center">
              +{sessions.length - 12} more
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mt-5 items-end">
        <Select label="Nurse" value={nurseId} onChange={(e) => setNurseId(e.target.value)}>
          <option value="">Assign later</option>
          {nurses.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </Select>
        <Checkbox
          label="Share with the nurse now"
          checked={share}
          onChange={setShare}
          disabled={!nurseId}
        />
      </div>

      {error && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3 mt-5">
          <span className="t-body text-[var(--color-ink-2)]">{error}</span>
        </div>
      )}

      <div className="mt-6">
        <Button size="lg" loading={busy} disabled={!patientId || !dripId} onClick={save}>
          Write the plan
        </Button>
      </div>
    </Card>
  );
}
