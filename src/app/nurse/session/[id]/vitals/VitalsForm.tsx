"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { VITAL_RANGES, type VitalKey } from "@/lib/clinical/checklist";
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

export function VitalsForm({
  bookingId,
  defaultWeight,
  previous,
}: {
  bookingId: string;
  defaultWeight?: number;
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
  const [values, setValues] = useState<Values>({
    systolic: "",
    diastolic: "",
    heartRate: "",
    spo2: "",
    temperatureF: "",
    weightKg: defaultWeight ? String(defaultWeight) : "",
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ outOfRange: string[]; blocks: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const flagged = FIELDS.filter((f) => isOut(f.vitalKey, values[f.key])).map((f) => f.label);
  const complete = FIELDS.filter((f) => f.vitalKey).every((f) => values[f.key] !== "");

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = Object.fromEntries(
        Object.entries(values)
          .filter(([, v]) => v !== "")
          .map(([k, v]) => [k, Number(v)])
      );
      const result = await queuedPost(
        `/api/bookings/${bookingId}/vitals`,
        { label: "baseline", ...payload },
        "Baseline vitals"
      );
      if (result.queued) {
        setError("Offline — this reading is queued and will sync when you reconnect.");
      } else if (!result.json.success) {
        setError(result.json.error ?? "Could not record the vitals");
      } else {
        const data = result.json.data as { outOfRange: string[]; blocksInfusion: boolean };
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
      {previous && (
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
              {previous.outOfRange.join(", ")} out of range
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
            Record it anyway. The infusion will be blocked and the reviewing physician notified — that is the correct
            outcome, not a failure.
          </p>
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
            {result.blocks ? "Recorded — infusion blocked" : "Recorded — all readings in range"}
          </span>
          <p className="t-body text-[var(--color-ink-2)] mt-1">
            {result.blocks
              ? "The physician has been notified. Do not cannulate until they clear it."
              : "You can move on to consent."}
          </p>
          <div className="mt-3">
            <Button variant="secondary" block onClick={() => router.push(`/nurse/session/${bookingId}`)}>
              Back to checklist
            </Button>
          </div>
        </div>
      ) : (
        <Button size="lg" block loading={busy} disabled={!complete} onClick={submit}>
          Record vitals
        </Button>
      )}
    </div>
  );
}
