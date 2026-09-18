"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, Checkbox } from "@/components/ui/Field";
import { DatePicker } from "@/components/ui/DatePicker";
import { Card } from "@/components/ui/Card";
import { DripPicker } from "@/components/ui/DripPicker";
import { ROUTES, UNITS } from "@/lib/models/types";
import type { AdminRoute, Unit } from "@/lib/models/types";
import {
  carrierApplies,
  componentsFromRecipe,
  DEFAULT_CARRIER,
  DEFAULT_SPACING_DAYS,
  scheduleDays,
  toDay,
  type PlanComponentInput,
  type RecipeLine,
} from "@/lib/clinical/plan-input";

/* ------------------------------------------------------------------ */
/* What the page hands in                                              */
/* ------------------------------------------------------------------ */

export type PlanPatient = {
  id: string;
  name: string;
  city?: string;
  /** On file, shown as a placeholder — a blank field means "use this". */
  age?: string;
  weightKg?: number;
  heightCm?: number;
  bloodGroup?: string;
};

export type PlanDrip = {
  id: string;
  name: string;
  category?: string;
  keywords?: Array<string | undefined>;
  /** The recipe, so choosing a drip fills its components in without a round trip. */
  ingredients: RecipeLine[];
};

/** A stocked product a component can be drawn from. */
export type PlanMaster = { id: string; name: string; unit: string };

/** An existing plan, opened for editing. */
export type PlanDraft = {
  id: string;
  patientId: string;
  diagnosis: string;
  startDate: string;
  nurseId: string;
  sharedWithNurse: boolean;
  patientAge: string;
  patientWeightKg: string;
  patientHeightCm: string;
  bloodGroup: string;
  weeks: Array<{
    weekNum: number;
    sessions: Array<{
      date: string;
      dripId: string;
      dripName: string;
      components: PlanComponentInput[];
      sessionNotes: string;
    }>;
  }>;
};

/* ------------------------------------------------------------------ */
/* Drafts                                                              */
/* ------------------------------------------------------------------ */

/**
 * A key per row, so removing the second of four components does not hand the
 * third one's value to the second one's input. An array index would.
 */
let seq = 0;
const nextKey = () => `r${(seq += 1)}`;

type CompDraft = PlanComponentInput & { k: string };
type SessionDraft = {
  k: string;
  day: string;
  dripId: string;
  dripName: string;
  components: CompDraft[];
  notes: string;
};
type WeekDraft = { weekNum: number; sessions: SessionDraft[] };

function sessionFor(day: string, drip: PlanDrip | undefined): SessionDraft {
  return {
    k: nextKey(),
    day,
    dripId: drip?.id ?? "",
    dripName: drip?.name ?? "",
    components: componentsFromRecipe(drip?.ingredients ?? []).map((c) => ({ ...c, k: nextKey() })),
    notes: "",
  };
}

function buildWeeks(opts: {
  startDate: string;
  totalWeeks: number;
  perWeek: number;
  spacing: number;
  drip: PlanDrip | undefined;
}): WeekDraft[] {
  const byWeek = new Map<number, SessionDraft[]>();
  for (const { weekNum, day } of scheduleDays({
    startDate: opts.startDate,
    totalWeeks: opts.totalWeeks,
    perWeek: opts.perWeek,
    spacingDays: opts.spacing,
  })) {
    byWeek.set(weekNum, [...(byWeek.get(weekNum) ?? []), sessionFor(day, opts.drip)]);
  }
  return [...byWeek].map(([weekNum, sessions]) => ({ weekNum, sessions }));
}

/** Days are held at UTC midnight, so they must be read back in UTC too. */
const dayLabel = (day: string) =>
  new Date(`${day}T00:00:00.000Z`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });

const shiftDay = (day: string, days: number) =>
  toDay(new Date(new Date(`${day}T00:00:00.000Z`).getTime() + days * 86_400_000));

/* ------------------------------------------------------------------ */
/* One component line                                                  */
/* ------------------------------------------------------------------ */

/**
 * Declared at module scope, not inside the builder: a component created during
 * render is a new type on every render, so React would remount every input on
 * each keystroke and the caret would jump to the end of the box.
 */
function ComponentRow({
  c,
  labelled,
  masters,
  onChange,
  onRemove,
}: {
  c: CompDraft;
  labelled: boolean;
  masters: PlanMaster[];
  onChange: (next: CompDraft) => void;
  onRemove: () => void;
}) {
  // A line written before products were recorded carries only a name. Say so,
  // rather than showing an empty box that reads as nothing prescribed.
  const orphan = !c.masterId && c.name ? c.name : null;
  const carrierOn = carrierApplies(c.route);

  return (
    // The dose column is wide enough for five digits and a decimal point.
    // 15000 mg is an ordinary ascorbic acid dose, and a dose that is cut off
    // by the edge of its own box is the one number on this row that must never
    // be guessed at.
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,2fr)_116px_92px_minmax(0,1.5fr)_minmax(0,1.3fr)_auto] md:items-end">
      <Select
        label={labelled ? "Product" : undefined}
        aria-label="Product"
        value={c.masterId ?? ""}
        onChange={(e) => {
          const m = masters.find((x) => x.id === e.target.value);
          onChange({
            ...c,
            masterId: m?.id,
            name: m?.name ?? c.name,
            unit: (m?.unit as Unit) ?? c.unit,
          });
        }}
      >
        {orphan ? <option value="">{orphan} — not in the product list</option> : null}
        {!orphan && !c.masterId ? <option value="">Choose a product…</option> : null}
        {masters.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </Select>

      <Input
        label={labelled ? "Dose" : undefined}
        aria-label="Dose"
        type="number"
        min={0}
        step="any"
        mono
        value={Number.isFinite(c.dose) ? c.dose : ""}
        onChange={(e) => onChange({ ...c, dose: Number(e.target.value) })}
      />

      <Select
        label={labelled ? "Unit" : undefined}
        aria-label="Unit"
        value={c.unit}
        onChange={(e) => onChange({ ...c, unit: e.target.value as Unit })}
      >
        {UNITS.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </Select>

      <Select
        label={labelled ? "Route" : undefined}
        aria-label="Route"
        value={c.route}
        onChange={(e) => {
          const route = e.target.value as AdminRoute;
          onChange({
            ...c,
            route,
            carrier: carrierApplies(route) ? (c.carrier ?? DEFAULT_CARRIER) : undefined,
          });
        }}
      >
        {ROUTES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </Select>

      <Input
        label={labelled ? "Carrier" : undefined}
        aria-label="Carrier"
        value={carrierOn ? (c.carrier ?? "") : ""}
        disabled={!carrierOn}
        placeholder={carrierOn ? DEFAULT_CARRIER : "Not carried"}
        onChange={(e) => onChange({ ...c, carrier: e.target.value || undefined })}
      />

      <div className="flex md:block">
        <Button
          variant="ghost"
          size="sm"
          onClick={onRemove}
          aria-label={`Remove ${c.name || "this component"}`}
        >
          Remove
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One session                                                         */
/* ------------------------------------------------------------------ */

function SessionCard({
  s,
  n,
  drips,
  masters,
  onChange,
  onRemove,
  canRemove,
}: {
  s: SessionDraft;
  n: number;
  drips: PlanDrip[];
  masters: PlanMaster[];
  onChange: (next: SessionDraft) => void;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const setComponents = (components: CompDraft[]) => onChange({ ...s, components });

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4 md:p-5">
      <div className="flex items-baseline justify-between gap-4 flex-wrap mb-4">
        <span className="t-micro">
          Session {n} · <span className="t-data text-[13px]">{dayLabel(s.day)}</span>
        </span>
        {canRemove ? (
          <Button variant="ghost" size="sm" onClick={onRemove}>
            Remove session
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[190px_minmax(0,1fr)]">
        <DatePicker
          label="Date"
          value={s.day}
          onChange={(v) => onChange({ ...s, day: v })}
        />
        <DripPicker
          label="Protocol"
          hint="Changing this rewrites the components below"
          value={s.dripId}
          onChange={(id) => {
            const drip = drips.find((d) => d.id === id);
            onChange({
              ...s,
              dripId: id,
              dripName: drip?.name ?? "",
              components: componentsFromRecipe(drip?.ingredients ?? []).map((c) => ({
                ...c,
                k: nextKey(),
              })),
            });
          }}
          options={drips.map((d) => ({
            id: d.id,
            name: d.name,
            category: d.category,
            keywords: d.keywords,
          }))}
        />
      </div>

      <div className="mt-5 pt-4 border-t border-[var(--color-line)]">
        <div className="flex items-baseline justify-between gap-4 mb-3">
          <span className="t-micro">Components · {s.components.length}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setComponents([
                ...s.components,
                {
                  k: nextKey(),
                  masterId: masters[0]?.id,
                  name: masters[0]?.name ?? "",
                  dose: 0,
                  unit: (masters[0]?.unit as Unit) ?? "mg",
                  route: "Add to Drip Bag",
                  carrier: DEFAULT_CARRIER,
                },
              ])
            }
          >
            Add a component
          </Button>
        </div>

        {s.components.length === 0 ? (
          <p className="t-small text-[var(--color-ink-3)]">
            Nothing written. The prescription will read &ldquo;as per the standard recipe&rdquo;.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {s.components.map((c, i) => (
              <ComponentRow
                key={c.k}
                c={c}
                labelled={i === 0}
                masters={masters}
                onChange={(next) => setComponents(s.components.map((x) => (x.k === c.k ? next : x)))}
                onRemove={() => setComponents(s.components.filter((x) => x.k !== c.k))}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-4">
        <Textarea
          label="Notes for this session"
          rows={2}
          value={s.notes}
          onChange={(e) => onChange({ ...s, notes: e.target.value })}
          placeholder="Run over 60 minutes · recheck BP at the halfway mark"
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The builder                                                         */
/* ------------------------------------------------------------------ */

/**
 * A course, written week by week.
 *
 * The settings at the top lay out a schedule; every session it produces is
 * then editable — its date, its protocol, each drug with dose, route and
 * carrier, and a note the nurse will read. A course is rarely the same drip on
 * a metronome, and a prescription that cannot say otherwise is not one.
 *
 * Components are chosen from the product list rather than typed. A typed name
 * cannot be checked against the shelf and cannot be traced in a recall, and
 * both of those are why the line is recorded at all.
 */
export function PlanBuilder({
  patients,
  nurses,
  drips,
  masters,
  initial,
  onDone,
}: {
  patients: PlanPatient[];
  nurses: Array<{ id: string; name: string }>;
  drips: PlanDrip[];
  masters: PlanMaster[];
  /** Present when an existing plan is being edited. */
  initial?: PlanDraft;
  onDone?: () => void;
}) {
  const router = useRouter();
  const editing = Boolean(initial);

  const [open, setOpen] = useState(editing);
  const [patientId, setPatientId] = useState(initial?.patientId ?? patients[0]?.id ?? "");
  const [diagnosis, setDiagnosis] = useState(initial?.diagnosis ?? "");
  const [startDate, setStartDate] = useState(initial?.startDate ?? toDay(new Date()));
  const [weeksWanted, setWeeksWanted] = useState(initial?.weeks.length ?? 4);
  const [perWeek, setPerWeek] = useState(1);
  const [spacing, setSpacing] = useState(DEFAULT_SPACING_DAYS);
  const [dripId, setDripId] = useState(drips[0]?.id ?? "");

  const [age, setAge] = useState(initial?.patientAge ?? "");
  const [weightKg, setWeightKg] = useState(initial?.patientWeightKg ?? "");
  const [heightCm, setHeightCm] = useState(initial?.patientHeightCm ?? "");
  const [bloodGroup, setBloodGroup] = useState(initial?.bloodGroup ?? "");

  const [nurseId, setNurseId] = useState(initial?.nurseId ?? "");
  const [share, setShare] = useState(initial?.sharedWithNurse ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Null while the schedule is still whatever the settings lay out. The first
   * edit by hand fills it in, and from then on the settings stop rewriting it
   * — a dose somebody typed is not thrown away by a stray click on "Weeks".
   */
  const [editedWeeks, setEditedWeeks] = useState<WeekDraft[] | null>(
    () =>
      initial?.weeks.map((w) => ({
        weekNum: w.weekNum,
        sessions: w.sessions.map((s) => ({
          k: nextKey(),
          day: toDay(s.date),
          dripId: s.dripId,
          dripName: s.dripName,
          components: s.components.map((c) => ({ ...c, k: nextKey() })),
          notes: s.sessionNotes ?? "",
        })),
      })) ?? null
  );
  const [activeWeek, setActiveWeek] = useState(1);

  const dripById = useMemo(() => new Map(drips.map((d) => [d.id, d])), [drips]);

  /**
   * Edit is pressed from a card that can be most of a page down while the form
   * opens at the top, so without this nothing appears to happen. Focus moves
   * too: somebody on a keyboard would otherwise still be standing on the card
   * they came from, with no idea a form had opened above them.
   */
  const cardRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (!editing) return;
    headingRef.current?.focus({ preventScroll: true });
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    cardRef.current?.scrollIntoView({ block: "start", behavior: still ? "auto" : "smooth" });
  }, [editing, initial?.id]);

  /** Editing is its own URL, so leaving it means leaving that URL. */
  const close = () => {
    setOpen(false);
    onDone?.();
    if (editing) router.push("/doctor/plans");
  };

  /**
   * Derived rather than held in state and synced by an effect: the settings
   * and the schedule are one value, and keeping two copies in step is exactly
   * where a form starts showing a physician something it is not about to save.
   */
  const generated = useMemo(
    () =>
      buildWeeks({
        startDate,
        totalWeeks: weeksWanted,
        perWeek,
        spacing,
        drip: dripById.get(dripId),
      }),
    [startDate, weeksWanted, perWeek, spacing, dripId, dripById]
  );

  const weeks = editedWeeks ?? generated;
  const touched = editedWeeks !== null;

  const patient = patients.find((p) => p.id === patientId);
  const sessionCount = weeks.reduce((n, w) => n + w.sessions.length, 0);
  const week = weeks.find((w) => w.weekNum === activeWeek) ?? weeks[0];

  const editWeek = (weekNum: number, sessions: SessionDraft[]) =>
    setEditedWeeks(weeks.map((w) => (w.weekNum === weekNum ? { ...w, sessions } : w)));

  const addWeek = () => {
    const weekNum = (weeks.at(-1)?.weekNum ?? 0) + 1;
    const last = weeks.at(-1)?.sessions.at(-1);
    setEditedWeeks([
      ...weeks,
      {
        weekNum,
        sessions: [sessionFor(last ? shiftDay(last.day, 7) : startDate, dripById.get(dripId))],
      },
    ]);
    setActiveWeek(weekNum);
  };

  const removeWeek = (weekNum: number) => {
    setEditedWeeks(
      weeks.filter((w) => w.weekNum !== weekNum).map((w, i) => ({ ...w, weekNum: i + 1 }))
    );
    setActiveWeek(1);
  };

  const rebuild = () => {
    setEditedWeeks(null);
    setActiveWeek(1);
  };

  /** A prescription a nurse cannot act on is not finished. */
  const incomplete = weeks.some((w) =>
    w.sessions.some((s) => !s.dripId || s.components.some((c) => !c.masterId || !(c.dose > 0)))
  );

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = {
        patientId,
        diagnosis: diagnosis || undefined,
        startDate: new Date(`${startDate}T00:00:00.000Z`).toISOString(),
        totalWeeks: weeks.length,
        patientAge: age || undefined,
        patientWeightKg: weightKg ? Number(weightKg) : undefined,
        patientHeightCm: heightCm ? Number(heightCm) : undefined,
        bloodGroup: bloodGroup || undefined,
        nurseId: nurseId || undefined,
        sharedWithNurse: share && Boolean(nurseId),
        weeks: weeks.map((w) => ({
          weekNum: w.weekNum,
          sessions: w.sessions.map((s) => ({
            date: new Date(`${s.day}T00:00:00.000Z`).toISOString(),
            dripId: s.dripId || undefined,
            dripName: s.dripName,
            sessionNotes: s.notes || undefined,
            components: s.components.map((c) => ({
              masterId: c.masterId,
              name: c.name,
              dose: c.dose,
              unit: c.unit,
              route: c.route,
              carrier: carrierApplies(c.route) ? c.carrier : undefined,
            })),
          })),
        })),
      };

      const res = await fetch(initial ? `/api/plans/${initial.id}` : "/api/plans", {
        method: initial ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not write that plan");
      else {
        if (!initial) {
          setDiagnosis("");
          setEditedWeeks(null);
        }
        close();
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
      <div ref={cardRef} className="flex items-baseline justify-between gap-4 mb-5 scroll-mt-6">
        <h2 ref={headingRef} tabIndex={-1} className="t-h3 outline-none">
          {editing ? "Edit the treatment plan" : "Write a treatment plan"}
        </h2>
        <Button variant="ghost" onClick={close}>
          Cancel
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Select
          label="Patient"
          value={patientId}
          disabled={editing}
          hint={editing ? "fixed once written" : undefined}
          onChange={(e) => setPatientId(e.target.value)}
        >
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.city ? ` — ${p.city}` : ""}
            </option>
          ))}
        </Select>
        <DripPicker
          label="Starting protocol"
          hint="every session begins as this, then can be changed"
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

      <div className="mt-5 pt-5 border-t border-[var(--color-line)]">
        <span className="t-micro block mb-3">Patient at the time of prescribing</span>
        <p className="t-small text-[var(--color-ink-3)] -mt-2 mb-3">
          Leave a field blank to take what is on the patient&rsquo;s record.
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input
            label="Age"
            mono
            value={age}
            placeholder={patient?.age ?? "—"}
            onChange={(e) => setAge(e.target.value)}
          />
          <Input
            label="Weight"
            hint="kg"
            type="number"
            min={0}
            step="any"
            mono
            value={weightKg}
            placeholder={patient?.weightKg ? String(patient.weightKg) : "—"}
            onChange={(e) => setWeightKg(e.target.value)}
          />
          <Input
            label="Height"
            hint="cm"
            type="number"
            min={0}
            step="any"
            mono
            value={heightCm}
            placeholder={patient?.heightCm ? String(patient.heightCm) : "—"}
            onChange={(e) => setHeightCm(e.target.value)}
          />
          <Input
            label="Blood group"
            mono
            value={bloodGroup}
            placeholder={patient?.bloodGroup ?? "—"}
            onChange={(e) => setBloodGroup(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-5 pt-5 border-t border-[var(--color-line)]">
        <span className="t-micro block mb-3">Lay out the schedule</span>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DatePicker
            label="Starts"
            value={startDate}
            onChange={setStartDate}
          />
          <Input
            label="Weeks"
            type="number"
            min={1}
            max={52}
            mono
            value={weeksWanted}
            onChange={(e) => setWeeksWanted(Math.max(1, Math.min(52, Number(e.target.value) || 1)))}
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
          <Input
            label="Days apart"
            hint="within a week"
            type="number"
            min={1}
            max={6}
            mono
            value={spacing}
            onChange={(e) => setSpacing(Math.max(1, Math.min(6, Number(e.target.value) || 1)))}
          />
        </div>
        {touched ? (
          <div className="flex items-baseline gap-3 flex-wrap mt-3">
            <span className="t-small text-[var(--color-ink-3)]">
              The schedule below has been edited by hand, so these settings no longer rewrite it.
            </span>
            <Button variant="ghost" size="sm" onClick={rebuild}>
              Lay it out again — discards the edits
            </Button>
          </div>
        ) : null}
      </div>

      <div className="mt-5 pt-5 border-t border-[var(--color-line)]">
        <div className="flex items-baseline justify-between gap-4 flex-wrap mb-3">
          <span className="t-micro">
            Schedule · {weeks.length} week{weeks.length === 1 ? "" : "s"} · {sessionCount} session
            {sessionCount === 1 ? "" : "s"}
          </span>
          <Button variant="ghost" size="sm" onClick={addWeek}>
            Add a week
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 mb-4" role="tablist" aria-label="Weeks">
          {weeks.map((w) => {
            const on = w.weekNum === activeWeek;
            return (
              <button
                key={w.weekNum}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setActiveWeek(w.weekNum)}
                className={`t-data text-[13px] px-[12px] py-[6px] rounded-full border cursor-pointer ${
                  on
                    ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                    : "border-[var(--color-line-2)] bg-[var(--color-surface)] text-[var(--color-ink)]"
                }`}
              >
                W{w.weekNum}
                <span className="ml-[6px] opacity-70">{w.sessions.length}</span>
              </button>
            );
          })}
        </div>

        {week ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between gap-4 flex-wrap">
              <span className="t-micro">Week {week.weekNum}</span>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const last = week.sessions.at(-1);
                    editWeek(week.weekNum, [
                      ...week.sessions,
                      sessionFor(
                        last ? shiftDay(last.day, spacing) : startDate,
                        dripById.get(dripId)
                      ),
                    ]);
                  }}
                >
                  Add a session
                </Button>
                {weeks.length > 1 ? (
                  <Button variant="ghost" size="sm" onClick={() => removeWeek(week.weekNum)}>
                    Remove week {week.weekNum}
                  </Button>
                ) : null}
              </div>
            </div>

            {week.sessions.length === 0 ? (
              <p className="t-small text-[var(--color-ink-3)]">
                No sessions in this week. Add one, or remove the week.
              </p>
            ) : (
              week.sessions.map((s, i) => (
                <SessionCard
                  key={s.k}
                  s={s}
                  n={i + 1}
                  drips={drips}
                  masters={masters}
                  canRemove={sessionCount > 1}
                  onChange={(next) =>
                    editWeek(
                      week.weekNum,
                      week.sessions.map((x) => (x.k === s.k ? next : x))
                    )
                  }
                  onRemove={() =>
                    editWeek(
                      week.weekNum,
                      week.sessions.filter((x) => x.k !== s.k)
                    )
                  }
                />
              ))
            )}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 mt-5 pt-5 border-t border-[var(--color-line)] items-end">
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

      {incomplete ? (
        <p className="t-small text-[var(--color-caution-text)] mt-4">
          Every session needs a protocol, and every component a product and a dose above zero.
        </p>
      ) : null}

      {error ? (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3 mt-5">
          <span className="t-body text-[var(--color-ink-2)]">{error}</span>
        </div>
      ) : null}

      <div className="mt-6">
        <Button
          size="md"
          loading={busy}
          disabled={!patientId || sessionCount === 0 || incomplete}
          onClick={save}
        >
          {editing ? "Save the changes" : "Write the plan"}
        </Button>
      </div>
    </Card>
  );
}
