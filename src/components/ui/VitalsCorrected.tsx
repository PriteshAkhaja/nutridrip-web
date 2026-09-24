import { vitalsLine, type VitalsCorrection } from "@/lib/clinical/checklist";

/**
 * "Corrected 12:41 pm · Typing mistake · was 1200/80 · 72 bpm …" -- under a
 * vitals reading a nurse corrected, so a changed value is never shown as if it
 * had always said that.
 *
 * Staff see what it said before (`detail`); a patient is told only that it was
 * corrected and why -- a mistyped 1200 on their own report would alarm rather
 * than inform. Renders nothing for a reading never corrected.
 */
export function VitalsCorrected({
  corrections,
  name,
  detail = false,
}: {
  corrections?: VitalsCorrection[] | null;
  /** Which reading, when the screen shows more than one: "Baseline", "Closing". */
  name?: string;
  detail?: boolean;
}) {
  if (!corrections?.length) return null;
  return (
    <div className="flex flex-col gap-[2px] mt-2">
      {corrections.map((c, i) => (
        <span key={i} className="t-small text-[var(--color-ink-3)]">
          {name ? `${name} reading corrected` : "Corrected"}
          {detail ? "" : " by your nurse"}
          {" at "}
          <span className="t-data text-[12.5px]">
            {new Date(c.at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
          </span>
          {` · ${c.reason}`}
          {detail && c.before ? ` · was ${vitalsLine(c.before)}` : ""}
        </span>
      ))}
    </div>
  );
}
