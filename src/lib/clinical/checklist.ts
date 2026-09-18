import type { ChecklistPhase } from "@/lib/models/types";

export type ChecklistStepDef = {
  key: string;
  phase: ChecklistPhase;
  label: string;
  detail?: string;
  /** Mandatory steps gate the session — they cannot be skipped. */
  mandatory: boolean;
  /** Steps that open a sub-screen rather than being a simple tick. */
  opens?: "vitals" | "consent" | "kit" | "observation";
};

/**
 * The 29-step checklist that bounds every session: 11 pre-session, 7 in
 * preparation, 4 during the infusion, 7 after. The phase counts are what the
 * FillSegments row on the nurse app reports.
 */
export const CHECKLIST_STEPS: ChecklistStepDef[] = [
  /* ---------------- Pre-session · 11 ---------------- */
  { key: "ps-01", phase: "Pre-session", label: "Confirm the booking and arrival window", mandatory: true },
  { key: "ps-02", phase: "Pre-session", label: "Verify patient identity and booking ID", mandatory: true },
  { key: "ps-03", phase: "Pre-session", label: "Confirm the physician-approved protocol on file", mandatory: true },
  { key: "ps-04", phase: "Pre-session", label: "Re-check allergies and current medication", detail: "Ask aloud; do not rely on the record alone.", mandatory: true },
  { key: "ps-05", phase: "Pre-session", label: "Screen for contraindications since approval", detail: "Pregnancy, renal or cardiac change, new medication.", mandatory: true },
  { key: "ps-06", phase: "Pre-session", label: "Confirm last meal and fluid intake", mandatory: false },
  { key: "ps-07", phase: "Pre-session", label: "Inspect the sealed kit and confirm the seal is intact", mandatory: true, opens: "kit" },
  { key: "ps-08", phase: "Pre-session", label: "Confirm the anaphylaxis kit is present and in date", mandatory: true },
  { key: "ps-09", phase: "Pre-session", label: "Set up a clean working surface", mandatory: false },
  { key: "ps-10", phase: "Pre-session", label: "Hand hygiene and gloves", mandatory: true },
  { key: "ps-11", phase: "Pre-session", label: "Inspect vial seals and expiry dates", detail: "Every vial, against the batch numbers on the order.", mandatory: true },

  /* ---------------- Preparation · 7 ---------------- */
  { key: "pr-01", phase: "Preparation", label: "Record baseline vitals", detail: "BP, HR, SpO₂, temperature and weight before any cannulation. Out-of-range values block the next step.", mandatory: true, opens: "vitals" },
  { key: "pr-02", phase: "Preparation", label: "Capture consent", detail: "Read the risks aloud, then capture the signature or OTP.", mandatory: true, opens: "consent" },
  { key: "pr-03", phase: "Preparation", label: "Confirm each component against the prescription", mandatory: true },
  { key: "pr-04", phase: "Preparation", label: "Draw up and label every additive", mandatory: true },
  { key: "pr-05", phase: "Preparation", label: "Prime the line and check for air", mandatory: true },
  { key: "pr-06", phase: "Preparation", label: "Select the cannulation site", mandatory: false },
  { key: "pr-07", phase: "Preparation", label: "Cannulate and secure", mandatory: true },

  /* ---------------- During infusion · 4 ---------------- */
  { key: "di-01", phase: "During infusion", label: "Start the carrier and confirm it runs clear", mandatory: true },
  { key: "di-02", phase: "During infusion", label: "Set the rate and record the start time", mandatory: true },
  { key: "di-03", phase: "During infusion", label: "Introduce the additives in the prescribed order", mandatory: true },
  { key: "di-04", phase: "During infusion", label: "Observe at 10-minute intervals", detail: "Log anything the patient reports, however minor.", mandatory: true, opens: "observation" },

  /* ---------------- Post-session · 7 ---------------- */
  { key: "po-01", phase: "Post-session", label: "Stop the infusion and flush the line", mandatory: true },
  { key: "po-02", phase: "Post-session", label: "Remove the cannula and apply pressure", mandatory: true },
  { key: "po-03", phase: "Post-session", label: "Record closing vitals", mandatory: true, opens: "vitals" },
  { key: "po-04", phase: "Post-session", label: "Observe for 10 minutes before leaving", mandatory: true },
  { key: "po-05", phase: "Post-session", label: "Give aftercare instructions", mandatory: true },
  { key: "po-06", phase: "Post-session", label: "Dispose of sharps and clinical waste", mandatory: true },
  { key: "po-07", phase: "Post-session", label: "Submit the session report", detail: "Vitals, doses, batch numbers and aftercare notes.", mandatory: true },
];

/**
 * The steps a physician's clearance gates.
 *
 * Gating only the "During infusion" phase was not enough: cannulation happens
 * in Preparation, and a cannula sited on a patient whose baseline is outside
 * its band is already the harm the block exists to prevent. So the gate starts
 * at the first invasive act and runs to the end of the infusion.
 */
export const BLOCKED_BY_VITALS: ReadonlyArray<string> = [
  "pr-05", // prime the line
  "pr-06", // select the cannulation site
  "pr-07", // cannulate and secure
  "di-01",
  "di-02",
  "di-03",
  "di-04",
];

/** Does an out-of-range baseline stop this step until a physician clears it? */
export function blockedByVitals(step: { key: string; phase: string }): boolean {
  return BLOCKED_BY_VITALS.includes(step.key) || step.phase === "During infusion";
}

/**
 * The first step that needs the prescription open.
 *
 * The patient's code is the proof the nurse is actually with the patient, and
 * until then the nurse only gets the checks that happen on the doorstep —
 * booking, identity, protocol, allergies, contraindications, last meal. From
 * the kit check onward they are handling the drugs or the patient's body.
 *
 * Locking only the screens that show the drugs was not enough: the checklist
 * would still record "Confirm each component against the prescription" as done
 * by a nurse who had never seen it. A nurse is never stuck here, because a
 * physician's authorisation or a recorded break-glass also opens it.
 */
export const PRESCRIPTION_FROM = "ps-07";

/**
 * Does ticking this step need the prescription unlocked?
 *
 * Decided by position, not by a list of keys: a step added later is covered
 * without anyone remembering to add it. A key this list does not know is
 * treated as needing it — a guard that fails open is not a guard.
 */
export function needsPrescription(key: string): boolean {
  const from = CHECKLIST_STEPS.findIndex((s) => s.key === PRESCRIPTION_FROM);
  const at = CHECKLIST_STEPS.findIndex((s) => s.key === key);
  return at === -1 || at >= from;
}

export const PHASE_ORDER: ChecklistPhase[] = [
  "Pre-session",
  "Preparation",
  "During infusion",
  "Post-session",
];

export type PhaseProgress = { phase: ChecklistPhase; done: number; total: number };

export function phaseProgress(
  checklist: Array<{ phase: string; doneAt?: Date | string | null }>
): PhaseProgress[] {
  return PHASE_ORDER.map((phase) => {
    const steps = checklist.filter((s) => s.phase === phase);
    return {
      phase,
      done: steps.filter((s) => s.doneAt).length,
      total: steps.length,
    };
  });
}

/** Reference ranges. A reading outside its band blocks the next step. */
export const VITAL_RANGES = {
  systolic: { min: 90, max: 140, label: "Blood pressure", unit: "mmHg" },
  diastolic: { min: 60, max: 90, label: "Blood pressure", unit: "mmHg" },
  heartRate: { min: 60, max: 100, label: "Heart rate", unit: "bpm" },
  spo2: { min: 95, max: 100, label: "SpO₂", unit: "%" },
  temperatureF: { min: 97.0, max: 99.5, label: "Temperature", unit: "°F" },
} as const;

export type VitalKey = keyof typeof VITAL_RANGES;

export function outOfRange(vitals: Partial<Record<VitalKey, number>>): VitalKey[] {
  return (Object.keys(VITAL_RANGES) as VitalKey[]).filter((k) => {
    const v = vitals[k];
    if (v === undefined || v === null || Number.isNaN(v)) return false;
    const range = VITAL_RANGES[k];
    return v < range.min || v > range.max;
  });
}
