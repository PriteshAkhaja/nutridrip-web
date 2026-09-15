"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Field";
import { queuedPost } from "@/lib/offline/queue";

const SYMPTOMS = [
  "Flushing",
  "Light-headed",
  "Nausea",
  "Rash",
  "Breathlessness",
  "Chest tightness",
  "Swelling at site",
  "Palpitations",
];

const ACTIONS = [
  "Stopped the infusion",
  "Saline flush given",
  "Patient laid flat, legs raised",
  "Oxygen given",
  "Anaphylaxis kit used",
  "Emergency services called",
];

const SEVERITIES = [
  { key: "mild", label: "Mild", note: "Settled without intervention" },
  { key: "moderate", label: "Moderate", note: "Needed intervention, patient stable" },
  { key: "severe", label: "Severe", note: "Emergency response, escalate now" },
] as const;

/** Multi-select chips: red when selected, because these are clinical facts. */
function Chips({
  options,
  selected,
  onToggle,
}: {
  options: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(o)}
            className="min-h-[44px] px-4 rounded-[var(--radius-sm)] border cursor-pointer text-[14.5px]"
            style={{
              borderColor: on ? "var(--color-critical)" : "var(--color-line-2)",
              background: on ? "var(--color-critical-soft)" : "var(--color-surface)",
              color: on ? "var(--color-critical)" : "var(--color-ink)",
              fontWeight: on ? 600 : 400,
            }}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

export function AdverseForm({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [severity, setSeverity] = useState<"mild" | "moderate" | "severe">("moderate");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const toggle = (list: string[], set: (v: string[]) => void) => (v: string) =>
    set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await queuedPost(
        `/api/bookings/${bookingId}/adverse`,
        {
          symptoms,
          severity,
          actionsTaken: actions,
          infusionStopped: actions.includes("Stopped the infusion"),
          notes: notes || undefined,
        },
        "Adverse event report"
      );
      if (result.queued) {
        setError("Offline — this report is queued and will sync the moment you reconnect. Stay with the patient.");
      } else if (!result.json.success) {
        setError(result.json.error ?? "Could not file the report");
      } else {
        setDone(true);
        router.refresh();
      }
    } catch {
      setError("Could not file the report. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-safe)] bg-[var(--color-safe-soft)] p-6 flex flex-col gap-3">
        <span className="t-h3">Reported and escalated</span>
        <p className="t-body text-[var(--color-ink-2)]">
          The reviewing physician has it. Stay with the patient until they respond, and add observations as things
          change.
        </p>
        <Button variant="secondary" block onClick={() => router.push(`/nurse/session/${bookingId}`)}>
          Back to the session
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="t-micro block mb-3">What is the patient reporting</span>
        <Chips options={SYMPTOMS} selected={symptoms} onToggle={toggle(symptoms, setSymptoms)} />
      </div>

      <div>
        <span className="t-micro block mb-3">Severity</span>
        <div className="flex flex-col gap-2">
          {SEVERITIES.map((s) => {
            const on = severity === s.key;
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={on}
                onClick={() => setSeverity(s.key)}
                className="text-left min-h-[44px] px-4 py-3 rounded-[var(--radius-sm)] border cursor-pointer flex flex-col gap-1"
                style={{
                  borderColor: on ? "var(--color-critical)" : "var(--color-line-2)",
                  background: on ? "var(--color-critical-soft)" : "var(--color-surface)",
                }}
              >
                <span className="t-body font-semibold">{s.label}</span>
                <span className="t-small text-[var(--color-ink-2)]">{s.note}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <span className="t-micro block mb-3">What you did</span>
        <Chips options={ACTIONS} selected={actions} onToggle={toggle(actions, setActions)} />
      </div>

      <Textarea
        label="Anything else"
        placeholder="Timing, how quickly it settled, what the patient said."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />

      {error && <span className="t-small text-[var(--color-caution-text)]">{error}</span>}

      <Button
        variant="danger"
        size="lg"
        block
        loading={busy}
        disabled={symptoms.length === 0}
        onClick={submit}
      >
        File and escalate
      </Button>
    </div>
  );
}
