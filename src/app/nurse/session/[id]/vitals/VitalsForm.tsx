"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { CORRECTION_REASONS, VITAL_RANGES, type VitalKey } from "@/lib/clinical/checklist";
import { queuedPost } from "@/lib/offline/queue";

type Values = {
  systolic: string;
  diastolic: string;
  heartRate: string;
  spo2: string;
  temperatureF: string;
  weightKg: string;
};

const FIELDS: Array<{
  key: keyof Values;
  vitalKey: VitalKey | null;
  label: string;
  hint: string;
  placeholder: string;
  step?: string;
}> = [
  { key: "systolic", vitalKey: "systolic", label: "Systolic", hint: "90 – 140 mmHg", placeholder: "122" },
  { key: "diastolic", vitalKey: "diastolic", label: "Diastolic", hint: "60 – 90 mmHg", placeholder: "78" },
  { key: "heartRate", vitalKey: "heartRate", label: "Heart rate", hint: "60 – 100 bpm", placeholder: "74" },
  { key: "spo2", vitalKey: "spo2", label: "SpO₂", hint: "95 – 100 %", placeholder: "98" },
  {
    key: "temperatureF",
    vitalKey: "temperatureF",
    label: "Temperature",
    hint: "97.0 – 99.5 °F",
    placeholder: "98.4",
    step: "0.1",
  },
  { key: "weightKg", vitalKey: null, label: "Weight", hint: "kg", placeholder: "58", step: "0.1" },
];

/** A reading outside its band turns the field critical the moment it is typed. */
function isOut(key: VitalKey | null, raw: string): boolean {
  if (!key || raw === "") return false;
  const v = Number(raw);
  if (Number.isNaN(v)) return false;
  const range = VITAL_RANGES[key];
  return v < range.min || v > range.max;
}

type Correcting = {
  /** 0 baseline, 1 closing. */
  index: number;
  which: "baseline" | "closing";
  takenAt: string;
  outOfRange: string[];
  systolic?: number;
  diastolic?: number;
  heartRate?: number;
  spo2?: number;
  temperatureF?: number;
  weightKg?: number;
};

/** "SpO₂, Heart rate" -- the readings' names as the nurse knows them, not the field names. */
const rangeNames = (keys: string[]) =>
  [...new Set(keys.map((k) => VITAL_RANGES[k as VitalKey]?.label ?? k))].join(", ");

const text = (n: number | undefined) => (n === undefined || n === null ? "" : String(n));

export function VitalsForm({
  bookingId,
  defaultWeight,
  correcting = null,
  previous,
}: {
  bookingId: string;
  defaultWeight?: number;
  /** Set when a reading entered wrongly is being corrected, with what it says now. */
  correcting?: Correcting | null;
  previous: {
    takenAt: string;
    label: string;
    outOfRange: string[];
    systolic?: number;
    diastolic?: number;
    heartRate?: number;
    spo2?: number;
    temperatureF?: number;
  } | null;
}) {
  const router = useRouter();
  // Correcting starts from the reading as recorded, so only the wrong value is retyped.
  const [values, setValues] = useState<Values>(
    correcting
      ? {
          systolic: text(correcting.systolic),
          diastolic: text(correcting.diastolic),
          heartRate: text(correcting.heartRate),
          spo2: text(correcting.spo2),
          temperatureF: text(correcting.temperatureF),
          weightKg: text(correcting.weightKg),
        }
      : {
          systolic: "",
          diastolic: "",
          heartRate: "",
          spo2: "",
          temperatureF: "",
          weightKg: defaultWeight ? String(defaultWeight) : "",
        }
  );
  const [reason, setReason] = useState<string>("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ outOfRange: string[]; blocks: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const flagged = FIELDS.filter((f) => isOut(f.vitalKey, values[f.key])).map((f) => f.label);
  const complete = FIELDS.filter((f) => f.vitalKey).every((f) => values[f.key] !== "");
  // A correction has to change something, and say why.
  const changed =
    !correcting || FIELDS.some((f) => values[f.key] !== text(correcting[f.key as keyof Correcting] as number | undefined));
  const explained = !correcting || (reason !== "" && (reason !== "Other" || note.trim() !== ""));
  // Said under the button while it is off: a greyed-out Save with no reason
  // given read as broken, when it was only waiting for a choice above it.
  const missing = !complete
    ? "Fill in every reading to save."
    : !changed
      ? "Change the value that was entered wrongly."
      : !explained
        ? reason === "Other"
          ? "Say what was wrong with it, above."
          : "Choose why it is being corrected, above."
        : null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = Object.fromEntries(
        Object.entries(values)
          .filter(([, v]) => v !== "")
          .map(([k, v]) => [k, Number(v)])
      );
      const result = correcting
        ? await queuedPost(
            `/api/bookings/${bookingId}/vitals/correct`,
            { index: correcting.index, reason, ...(reason === "Other" ? { note: note.trim() } : {}), ...payload },
            `Correct ${correcting.which} vitals`
          )
        : await queuedPost(`/api/bookings/${bookingId}/vitals`, { label: "baseline", ...payload }, "Baseline vitals");
      if (result.queued) {
        setError("Offline — this reading is queued and will sync when you reconnect.");
      } else if (!result.json.success) {
        setError(result.json.error ?? "Could not record the vitals");
      } else {
        const data = result.json.data as { outOfRange: string[]; blocksInfusion: boolean };
        // Both the record and the correction answer with blocksInfusion.
        setResult({ outOfRange: data.outOfRange, blocks: data.blocksInfusion });
        router.refresh();
      }
    } catch {
      setError("Could not record the vitals. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {correcting && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-3">
          <span className="t-micro">
            Recorded ·{" "}
            {new Date(correcting.takenAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
          </span>
          <div className="t-data text-[14.5px] mt-1">
            {correcting.systolic}/{correcting.diastolic} · {correcting.heartRate} bpm · SpO₂ {correcting.spo2}% ·{" "}
            {correcting.temperatureF}°F
          </div>
          {correcting.outOfRange.length > 0 && (
            <span className="t-small text-[var(--color-critical-text)] block mt-1">
              {rangeNames(correcting.outOfRange)} out of range
            </span>
          )}
        </div>
      )}

      {!correcting && previous && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-3">
          <span className="t-micro">
            Last reading ·{" "}
            {new Date(previous.takenAt).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })}
          </span>
          <div className="t-data text-[14.5px] mt-1">
            {previous.systolic}/{previous.diastolic} · {previous.heartRate} bpm · SpO₂ {previous.spo2}% ·{" "}
            {previous.temperatureF}°F
          </div>
          {previous.outOfRange.length > 0 && (
            <span className="t-small text-[var(--color-critical-text)] block mt-1">
              {rangeNames(previous.outOfRange)} out of range
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {FIELDS.map((f) => {
          const out = isOut(f.vitalKey, values[f.key]);
          return (
            <label key={f.key} className="flex flex-col gap-[7px] min-w-0">
              <span className="t-micro">{f.label}</span>
              <input
                type="number"
                inputMode="decimal"
                step={f.step}
                placeholder={f.placeholder}
                value={values[f.key]}
                onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                aria-invalid={out || undefined}
                className="min-h-[44px] w-full px-[14px] rounded-[var(--radius-sm)] border text-[14.5px]"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontWeight: 500,
                  borderColor: out ? "var(--color-critical)" : "var(--color-line-2)",
                  background: out ? "var(--color-critical-soft)" : "var(--color-surface)",
                }}
              />
              <span
                className="t-small"
                style={{ color: out ? "var(--color-critical)" : "var(--color-ink-3)" }}
              >
                {out ? `Outside ${f.hint}` : f.hint}
              </span>
            </label>
          );
        })}
      </div>

      {flagged.length > 0 && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3">
          <span className="t-body font-semibold">{flagged.join(", ")} outside the reference range</span>
          <p className="t-body text-[var(--color-ink-2)] mt-1">
            {correcting
              ? "Save it anyway if that is the real reading. The infusion stays blocked and the physician is told."
              : "Record it anyway. The infusion will be blocked and the reviewing physician notified — that is the correct outcome, not a failure."}
          </p>
        </div>
      )}

      {correcting && !result && (
        <div role="radiogroup" aria-label="Why is it being corrected?" className="flex flex-col gap-[7px]">
          <span className="t-micro">Why is it being corrected?</span>
          <div className="flex gap-2 flex-wrap">
            {CORRECTION_REASONS.map((r) => {
              const on = reason === r;
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setReason(r)}
                  className="min-h-[40px] px-4 rounded-full border cursor-pointer text-[14px]"
                  style={{
                    borderColor: on ? "var(--color-primary)" : "var(--color-line-2)",
                    background: on ? "var(--color-primary-soft)" : "var(--color-surface)",
                    color: on ? "var(--color-primary-dark)" : "var(--color-ink)",
                    fontWeight: on ? 600 : 400,
                  }}
                >
                  {r}
                </button>
              );
            })}
          </div>
          {reason === "Other" && (
            <input
              type="text"
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What was wrong with it"
              aria-label="What was wrong with it"
              className="min-h-[44px] w-full px-[14px] rounded-[var(--radius-sm)] border border-[var(--color-line-2)] bg-[var(--color-surface)] text-[14.5px] mt-1"
            />
          )}
        </div>
      )}

      {error && <span className="t-small text-[var(--color-caution-text)]">{error}</span>}

      {result ? (
        <div
          className="rounded-[var(--radius-md)] border px-4 py-3"
          style={{
            borderColor: result.blocks ? "var(--color-critical)" : "var(--color-safe)",
            background: result.blocks ? "var(--color-critical-soft)" : "var(--color-safe-soft)",
          }}
        >
          <span className="t-body font-semibold">
            {correcting
              ? result.blocks
                ? "Corrected — infusion still blocked"
                : "Corrected — all readings in range"
              : result.blocks
                ? "Recorded — infusion blocked"
                : "Recorded — all readings in range"}
          </span>
          <p className="t-body text-[var(--color-ink-2)] mt-1">
            {result.blocks
              ? "The physician has been notified. Do not cannulate until they clear it."
              : correcting
                ? "The block has lifted. You can carry on with the checklist."
                : "You can move on to consent."}
          </p>
          <div className="mt-3">
            <Button variant="secondary" block onClick={() => router.push(`/nurse/session/${bookingId}`)}>
              Back to checklist
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            size="lg"
            block
            loading={busy}
            disabled={missing !== null}
            onClick={submit}
            aria-describedby={missing ? "vitals-missing" : undefined}
          >
            {correcting ? "Save the correction" : "Record vitals"}
          </Button>
          {missing && (
            <span id="vitals-missing" className="t-small text-[var(--color-ink-2)] text-center">
              {missing}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
