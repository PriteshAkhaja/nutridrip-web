import type { ReactNode } from "react";
import { IconCheck, IconReport, IconStethoscope, IconVial, IconPulse, IconClipboard } from "./Icons";
import { APPROVAL_VALID_DAYS } from "@/lib/clinical/validity";

/**
 * Drawn product screens for the storytelling sections: what the quiz and the
 * session report look like, without pretending to be a screenshot of anyone's
 * record. No names, no readings, no batch numbers — labels and states only.
 * They sit on a soft ground so they read as a screen placed in the frame.
 */

function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[radial-gradient(120%_90%_at_30%_10%,var(--color-primary-soft)_0%,var(--color-mist)_45%,#e6eef1_100%)] p-4 sm:p-10">
      <div className="w-full max-w-[380px] rounded-[22px] border border-white bg-white p-4 shadow-[var(--shadow-float)] sm:rounded-[26px] sm:p-6">
        {children}
      </div>
    </div>
  );
}

export function QuizMock() {
  return (
    <Frame>
      <div className="flex items-center justify-between">
        <span className="t-micro">Health quiz</span>
        <span className="t-small text-[var(--color-ink-3)]">About 3 min</span>
      </div>
      <div className="mt-4 flex gap-[5px]" aria-hidden>
        {[1, 1, 1, 0, 0, 0, 0].map((on, i) => (
          <span
            key={i}
            className="h-[5px] flex-1 rounded-full"
            style={{ background: on ? "var(--color-primary)" : "var(--color-surface-2)" }}
          />
        ))}
      </div>
      <p className="mt-4 text-[17px] font-semibold leading-[1.3] tracking-[-0.02em] text-[var(--color-ink)] sm:mt-6 sm:text-[19px]">
        Are you pregnant, or trying to conceive?
      </p>
      <p className="t-small text-[var(--color-ink-3)] mt-2 hidden sm:block">
        Some answers rule IV therapy out. The quiz tells you straight away.
      </p>
      <div className="mt-4 flex flex-col gap-2 sm:mt-5">
        {["No", "Yes", "Not sure"].map((o, i) => (
          <div
            key={o}
            className="flex items-center justify-between rounded-[14px] border px-4 py-[10px] text-[14.5px] font-medium sm:py-3"
            style={{
              borderColor: i === 0 ? "var(--color-primary)" : "var(--color-line)",
              background: i === 0 ? "var(--color-primary-soft)" : "#fff",
              color: "var(--color-ink)",
            }}
          >
            {o}
            <span
              className="w-5 h-5 rounded-full border inline-flex items-center justify-center"
              style={{
                borderColor: i === 0 ? "var(--color-primary)" : "var(--color-line-2)",
                background: i === 0 ? "var(--color-primary)" : "transparent",
                color: "#fff",
              }}
            >
              {i === 0 ? <IconCheck size={13} /> : null}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end sm:mt-5">
        <span className="inline-flex min-h-[40px] items-center rounded-[var(--radius-sm)] bg-[var(--color-ink)] px-5 text-[13.5px] font-semibold text-white">
          Next
        </span>
      </div>
    </Frame>
  );
}

export function ReportMock() {
  const rows = [
    { icon: <IconPulse size={17} />, label: "Vitals before and after" },
    { icon: <IconClipboard size={17} />, label: "Every dose given" },
    { icon: <IconVial size={17} />, label: "Batch number of every vial" },
    { icon: <IconStethoscope size={17} />, label: "Physician and registration no." },
    { icon: <IconReport size={17} />, label: "Aftercare notes" },
  ];
  return (
    <Frame>
      <div className="flex items-center justify-between">
        <span className="t-micro">Session report</span>
        <span className="inline-flex items-center gap-1 t-small font-medium text-[var(--color-primary-text)]">
          <IconCheck size={14} />
          In your account
        </span>
      </div>
      <ul className="list-none m-0 p-0 mt-3 flex flex-col sm:mt-5">
        {rows.map((r) => (
          <li
            key={r.label}
            className="flex items-center gap-3 border-b border-[var(--color-line)] py-[10px] last:border-b-0 sm:py-3"
          >
            <span className="w-8 h-8 rounded-full bg-[var(--color-mist)] text-[var(--color-primary-text)] inline-flex items-center justify-center flex-none">
              {r.icon}
            </span>
            <span className="text-[14px] font-medium text-[var(--color-ink)] flex-1">{r.label}</span>
            <span className="text-[var(--color-primary)]">
              <IconCheck size={16} />
            </span>
          </li>
        ))}
      </ul>
      <p className="t-small text-[var(--color-ink-3)] mt-4">
        One approval covers your bookings for {APPROVAL_VALID_DAYS} days.
      </p>
    </Frame>
  );
}
