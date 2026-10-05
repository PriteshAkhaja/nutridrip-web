"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { useClockFormat } from "@/components/ClockProvider";
import { shortDateClock } from "@/lib/time";
import type { PayReceipt, PayState } from "./usePayment";

/**
 * What happens after Checkout closes, in one sheet that changes shape as the
 * payment moves: a turning ring and a live three-step tracker while the bank
 * answers; a drawn tick, a ripple and the amount counting up, with a receipt,
 * when it is done; the same tracker for money on its way back.
 *
 * A sheet from the bottom on a phone (with its grab handle), a floating card on
 * a wider screen. Its height glides between states and each state fades in, so
 * nothing jumps. While confirming it cannot be dismissed: closing the page then
 * is the one moment that could leave somebody unsure whether they paid.
 *
 * Motion is transform and opacity only, with no blur, and every animation runs
 * from a hidden state -- with reduced motion each state simply appears as it ends.
 */
export function PaymentSheet({
  state,
  successTitle = "Payment successful",
  finishing = "Completing it",
  onContinue,
  onClose,
  onRetry,
}: {
  state: PayState;
  successTitle?: string;
  /** The third step while confirming: "Booking your session", "Moving your session"... */
  finishing?: string;
  /** After a success: carry on (navigate, refresh). */
  onContinue: () => void;
  onClose: () => void;
  onRetry?: () => void;
}) {
  const id = useId();
  const { phase } = state;
  const shown =
    phase === "confirming" || phase === "done" || phase === "refunded" || phase === "pending" || phase === "failed";
  const dismissable = phase !== "confirming";

  useEffect(() => {
    if (!shown) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissable) (phase === "done" ? onContinue : onClose)();
    };
    // Leaving mid-confirmation is the one thing to warn about.
    const onLeave = (e: BeforeUnloadEvent) => {
      if (phase === "confirming") e.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [shown, dismissable, phase, onClose, onContinue]);

  if (!shown) return null;

  const tone = {
    confirming: "var(--color-primary-soft)",
    done: "var(--color-safe-soft)",
    refunded: "var(--color-caution-soft)",
    pending: "var(--color-info-soft)",
    failed: "var(--color-critical-soft)",
  }[phase as "confirming" | "done" | "refunded" | "pending" | "failed"];

  return (
    <div
      className="pay-scrim fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-6 bg-[rgb(15_23_42/0.5)]"
      onClick={(e) => {
        if (e.target === e.currentTarget && dismissable) (phase === "done" ? onContinue : onClose)();
      }}
    >
      <div
        role={phase === "confirming" ? "status" : "alertdialog"}
        aria-modal="true"
        aria-live="polite"
        aria-labelledby={`${id}-title`}
        aria-describedby={phase === "done" ? undefined : `${id}-body`}
        className="pay-sheet relative w-full sm:max-w-[440px] rounded-t-[24px] sm:rounded-[24px] bg-[var(--color-surface)] overflow-hidden shadow-[0_-10px_40px_rgb(15_23_42/0.16)] sm:shadow-[0_28px_70px_rgb(15_23_42/0.28)]"
      >
        {/* A wash of the state's colour behind the mark; it cross-fades as the state changes. */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-[180px] pointer-events-none transition-[background] duration-500"
          style={{ background: `radial-gradient(120% 100% at 50% 0%, ${tone}, transparent 72%)` }}
        />
        <div
          aria-hidden
          className="sm:hidden relative mx-auto mt-3 h-[5px] w-10 rounded-full bg-[var(--color-line-2)]"
        />

        <GlideHeight>
          <div
            key={phase}
            className="pay-swap relative px-6 pt-6 sm:pt-8 pb-[max(24px,env(safe-area-inset-bottom))] flex flex-col items-center text-center gap-5"
          >
            <StatusMark phase={phase} />

            <div className="flex flex-col items-center gap-2 max-w-[34ch]">
              <span id={`${id}-title`} className="t-h3">
                {phase === "confirming"
                  ? "Confirming your payment"
                  : phase === "done"
                    ? successTitle
                    : phase === "refunded"
                      ? "Paid, and refunded"
                      : phase === "pending"
                        ? "Waiting for your bank"
                        : "The payment did not go through"}
              </span>
              {(phase === "done" || phase === "refunded") && state.receipt && (
                <CountUp
                  paise={phase === "refunded" && state.receipt.refunded ? state.receipt.refunded : state.receipt.amount}
                  className="t-data text-[30px] leading-[1.1] tracking-[-0.01em]"
                />
              )}
              {/* A success says it all in the title, amount and receipt; its message would only repeat "Paid." */}
              {phase !== "done" && (
                <p id={`${id}-body`} className="t-body text-[var(--color-ink-2)]" style={{ textWrap: "pretty" }}>
                  {phase === "confirming" ? "This takes a few seconds. Please keep this page open." : state.message}
                </p>
              )}
            </div>

            {phase === "confirming" && <Steps finishing={finishing} />}
            {phase === "done" && state.receipt && <Receipt receipt={state.receipt} receiptNo={state.receiptNo} />}
            {phase === "refunded" && <RefundTrack receiptNo={state.receiptNo} />}
            {phase === "pending" && state.receiptNo && (
              <span className="t-small text-[var(--color-ink-3)]">
                Reference <span className="t-data text-[12.5px]">{state.receiptNo}</span>
              </span>
            )}

            {phase === "done" && (
              <Button block size="lg" autoFocus onClick={onContinue}>
                Continue
              </Button>
            )}
            {(phase === "refunded" || phase === "pending") && (
              <Button block size="lg" variant="secondary" autoFocus onClick={onClose}>
                Close
              </Button>
            )}
            {phase === "failed" && (
              <div className="w-full flex flex-col gap-2">
                {onRetry && state.code !== "payments_off" && (
                  <Button block size="lg" autoFocus onClick={onRetry}>
                    Try again
                  </Button>
                )}
                <Button block size="lg" variant="secondary" autoFocus={!onRetry} onClick={onClose}>
                  Close
                </Button>
              </div>
            )}
          </div>
        </GlideHeight>
      </div>
    </div>
  );
}

/** Animates its height to whatever its content needs, so a state change glides instead of jumping. */
function GlideHeight({ children }: { children: ReactNode }) {
  const inner = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = inner.current;
    if (!el) return;
    const measure = () => setHeight(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div
      className="relative overflow-hidden transition-[height] duration-[380ms] ease-[var(--ease-glide)]"
      style={{ height: height ?? "auto" }}
    >
      <div ref={inner}>{children}</div>
    </div>
  );
}

/** The amount, counting up to itself once -- or simply shown, with reduced motion. */
function CountUp({ paise, className }: { paise: number; className?: string }) {
  // With reduced motion it starts where it ends; otherwise it climbs from nothing.
  const [shown, setShown] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches ? paise : 0
  );
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    // The frame clock throughout: a start from performance.now() can be later
    // than the next frame's timestamp, which would show a negative amount.
    let start: number | undefined;
    const ms = 750;
    const tick = (t: number) => {
      start ??= t;
      const k = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      setShown(Math.round(paise * eased));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paise]);
  const rupees = shown / 100;
  return (
    <span className={className} aria-label={`₹${(paise / 100).toLocaleString("en-IN")}`}>
      ₹
      {rupees.toLocaleString("en-IN", {
        minimumFractionDigits: paise % 100 === 0 ? 0 : 2,
        maximumFractionDigits: paise % 100 === 0 ? 0 : 2,
      })}
    </span>
  );
}

/** While confirming: what has happened, what is happening, what is next. */
function Steps({ finishing }: { finishing: string }) {
  const rows: Array<{ label: string; state: "done" | "now" | "next" }> = [
    { label: "Payment received by Razorpay", state: "done" },
    { label: "Confirming with your bank", state: "now" },
    { label: finishing, state: "next" },
  ];
  return (
    <ol className="w-full list-none m-0 p-0 flex flex-col gap-1 text-left rounded-[16px] border border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-3">
      {rows.map((r, i) => (
        <li
          key={r.label}
          className="pay-step flex items-center gap-3 min-h-[36px]"
          style={{ animationDelay: `${120 + i * 110}ms` }}
        >
          <StepDot state={r.state} />
          <span
            className="t-body"
            style={{
              color: r.state === "next" ? "var(--color-ink-3)" : "var(--color-ink)",
              fontWeight: r.state === "now" ? 600 : 400,
            }}
          >
            {r.label}
          </span>
        </li>
      ))}
    </ol>
  );
}

function StepDot({ state }: { state: "done" | "now" | "next" }) {
  if (state === "done") {
    return (
      <span
        className="w-6 h-6 rounded-full inline-flex items-center justify-center bg-[var(--color-safe)] flex-none"
        aria-hidden
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path
            d="M2.5 6.3 5 8.6l4.6-5.2"
            stroke="#fff"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  if (state === "now") {
    return (
      <span className="relative w-6 h-6 inline-flex items-center justify-center flex-none" aria-hidden>
        <span className="absolute inset-[1px] rounded-full border-2 border-[var(--color-primary-line)]" />
        <span className="pay-orbit-sm absolute inset-0 rounded-full" />
        <span className="pay-live w-2 h-2 rounded-full bg-[var(--color-primary)]" />
      </span>
    );
  }
  return (
    <span className="w-6 h-6 inline-flex items-center justify-center flex-none" aria-hidden>
      <span className="w-2 h-2 rounded-full border-2 border-[var(--color-line-2)]" />
    </span>
  );
}

/** The receipt, as a ticket: perforated, with notches, and every line a person may be asked for. */
function Receipt({ receipt, receiptNo }: { receipt: PayReceipt; receiptNo: string | null }) {
  const clockFmt = useClockFormat();
  const rows: Array<[string, string]> = [
    ["For", receipt.description ?? receipt.purposeLabel],
    ...(receipt.methodLabel ? ([["Paid with", receipt.methodLabel]] as Array<[string, string]>) : []),
    ...(receipt.paidAt ? ([["When", shortDateClock(receipt.paidAt, clockFmt)]] as Array<[string, string]>) : []),
  ];
  return (
    <div className="w-full text-left rounded-[16px] border border-[var(--color-line)] bg-[var(--color-surface-2)]">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="t-micro">Receipt</span>
        <span className="t-data text-[13px]">{receiptNo ?? "—"}</span>
      </div>
      {/* The tear line: dashed, with a notch cut from each side. */}
      <div className="relative" aria-hidden>
        <div className="border-t border-dashed border-[var(--color-line-2)] mx-4" />
        <span className="absolute -left-[9px] -top-[9px] w-[18px] h-[18px] rounded-full bg-[var(--color-surface)] border border-[var(--color-line)] [clip-path:inset(0_0_0_50%)]" />
        <span className="absolute -right-[9px] -top-[9px] w-[18px] h-[18px] rounded-full bg-[var(--color-surface)] border border-[var(--color-line)] [clip-path:inset(0_50%_0_0)]" />
      </div>
      <dl className="m-0 px-4 py-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
        {rows.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="t-small text-[var(--color-ink-3)]">{k}</dt>
            <dd className="m-0 t-small text-[var(--color-ink)] text-right break-words">{v}</dd>
          </div>
        ))}
        <div aria-hidden className="col-span-2 border-t border-[var(--color-line)] my-1" />
        <dt className="t-small font-semibold">Total paid</dt>
        <dd className="m-0 t-data text-[14.5px] text-right">₹{(receipt.amount / 100).toLocaleString("en-IN")}</dd>
      </dl>
    </div>
  );
}

/** Money on its way back: where it is now, and what comes next. */
function RefundTrack({ receiptNo }: { receiptNo: string | null }) {
  const steps: Array<{ label: string; state: "done" | "now" | "next" }> = [
    { label: "Refund started", state: "done" },
    { label: "With your bank", state: "now" },
    { label: "Back in your account · 5–7 working days", state: "next" },
  ];
  return (
    <div className="w-full flex flex-col gap-2">
      <ol className="w-full list-none m-0 p-0 flex flex-col gap-1 text-left rounded-[16px] border border-[var(--color-line)] bg-[var(--color-surface-2)] px-4 py-3">
        {steps.map((s, i) => (
          <li
            key={s.label}
            className="pay-step flex items-center gap-3 min-h-[36px]"
            style={{ animationDelay: `${140 + i * 110}ms` }}
          >
            <StepDot state={s.state} />
            <span className="t-body" style={{ color: s.state === "next" ? "var(--color-ink-3)" : "var(--color-ink)" }}>
              {s.label}
            </span>
          </li>
        ))}
      </ol>
      {receiptNo && (
        <span className="t-small text-[var(--color-ink-3)]">
          Receipt <span className="t-data text-[12.5px]">{receiptNo}</span> · you will be notified when it lands
        </span>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- marks */

// Brand colours only: the green of "paid" is a status, and a flourish must not borrow it.
const BURST: Array<{ dx: number; dy: number; rot: number; colour: string; delay: number; round?: boolean }> = [
  { dx: -64, dy: -38, rot: -40, colour: "var(--color-primary)", delay: 160 },
  { dx: 60, dy: -44, rot: 60, colour: "var(--color-accent)", delay: 180 },
  { dx: -48, dy: 30, rot: 90, colour: "var(--color-accent)", delay: 200, round: true },
  { dx: 52, dy: 36, rot: -70, colour: "var(--color-primary)", delay: 170, round: true },
  { dx: -12, dy: -66, rot: 30, colour: "var(--color-accent)", delay: 150 },
  { dx: 18, dy: 60, rot: -20, colour: "var(--color-primary)", delay: 220 },
  { dx: -74, dy: -4, rot: 120, colour: "var(--color-primary-line)", delay: 190, round: true },
  { dx: 76, dy: 2, rot: -110, colour: "var(--color-accent)", delay: 160 },
  { dx: 34, dy: -60, rot: 45, colour: "var(--color-primary)", delay: 240, round: true },
  { dx: -30, dy: 58, rot: -45, colour: "var(--color-accent)", delay: 210 },
];

/** The mark at the top: a turning ring, a drawn tick with a ripple and a burst, a returning arrow, a clock, or a cross. */
function StatusMark({ phase }: { phase: PayState["phase"] }) {
  const size = "relative w-[76px] h-[76px] flex-none inline-flex items-center justify-center";
  if (phase === "confirming") {
    return (
      <span className={size} aria-hidden>
        <span className="absolute inset-0 rounded-full border-[5px] border-[var(--color-primary-line)]" />
        <span className="pay-orbit absolute inset-0 rounded-full" />
        <span className="pay-pop w-11 h-11 rounded-full bg-[var(--color-surface)] shadow-[0_2px_10px_rgb(10_127_161/0.18)] inline-flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="4.5" y="9" width="11" height="8" rx="2" stroke="var(--color-primary)" strokeWidth="1.8" />
            <path d="M7 9V6.8a3 3 0 016 0V9" stroke="var(--color-primary)" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </span>
      </span>
    );
  }
  if (phase === "done") {
    return (
      <span className={size} aria-hidden>
        <span className="pay-ripple absolute inset-0 rounded-full border-2 border-[var(--color-safe)]" />
        <span className="pay-ripple-late absolute inset-0 rounded-full border-2 border-[var(--color-safe)]" />
        <span className="pay-burst absolute inset-0">
          {BURST.map((b, i) => (
            <i
              key={i}
              style={
                {
                  "--dx": `${b.dx}px`,
                  "--dy": `${b.dy}px`,
                  "--rot": `${b.rot}deg`,
                  "--delay": `${b.delay}ms`,
                  background: b.colour,
                  borderRadius: b.round ? "999px" : "2px",
                } as CSSProperties
              }
            />
          ))}
        </span>
        <span className="pay-pop relative w-[76px] h-[76px] rounded-full bg-[var(--color-safe)] shadow-[0_8px_24px_rgb(47_143_91/0.35)] inline-flex items-center justify-center">
          <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
            <path
              d="M10 19.5l6 6L28.5 13"
              className="pay-draw"
              style={{ ["--pay-len" as string]: "32", strokeDashoffset: 0 }}
              stroke="#fff"
              strokeWidth="3.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </span>
    );
  }
  if (phase === "refunded") {
    return (
      <span className={size} aria-hidden>
        <span className="pay-pop w-[76px] h-[76px] rounded-full bg-[var(--color-caution-soft)] border-2 border-[var(--color-caution)] inline-flex items-center justify-center">
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
            <path
              d="M12 9.5L7 14.5l5 5M7 14.5h13.5a7 7 0 010 14H16"
              className="pay-draw"
              style={{ ["--pay-len" as string]: "52", strokeDashoffset: 0 }}
              stroke="var(--color-caution-text)"
              strokeWidth="2.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </span>
    );
  }
  if (phase === "pending") {
    return (
      <span className={size} aria-hidden>
        <span className="pay-pop w-[76px] h-[76px] rounded-full bg-[var(--color-info-soft)] border-2 border-[var(--color-info)] inline-flex items-center justify-center">
          <svg width="34" height="34" viewBox="0 0 34 34" fill="none">
            <circle cx="17" cy="17" r="12" stroke="var(--color-info-text)" strokeWidth="2.4" />
            <g className="pay-spin" style={{ animationDuration: "6s", transformOrigin: "17px 17px" }}>
              <path d="M17 17V9.5" stroke="var(--color-info-text)" strokeWidth="2.4" strokeLinecap="round" />
            </g>
            <path d="M17 17l4.5 2.5" stroke="var(--color-info-text)" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </span>
      </span>
    );
  }
  return (
    <span className={size} aria-hidden>
      <span className="pay-pop pay-shake w-[76px] h-[76px] rounded-full bg-[var(--color-critical-soft)] border-2 border-[var(--color-critical)] inline-flex items-center justify-center">
        <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
          <path
            d="M9 9l12 12"
            className="pay-draw"
            style={{ ["--pay-len" as string]: "18", strokeDashoffset: 0 }}
            stroke="var(--color-critical-text)"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M21 9L9 21"
            className="pay-draw"
            style={{ ["--pay-len" as string]: "18", strokeDashoffset: 0, animationDelay: "320ms" }}
            stroke="var(--color-critical-text)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      </span>
    </span>
  );
}
