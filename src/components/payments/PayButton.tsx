"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import { PaymentSheet } from "./PaymentSheet";
import { usePayment, type PayState } from "./usePayment";

/**
 * A button that takes a payment. It starts a checkout for `request` (the
 * server works out the amount), opens Razorpay, confirms the result, and shows
 * what happened. After a success, `navigate` takes the person where the
 * payment's own page is; otherwise the current page reloads its data.
 *
 * While Razorpay's window is open the button says so, with a live dot, rather
 * than looking stuck; a closed window or a refusal is said right under it.
 */
export function PayButton({
  request,
  children,
  successTitle,
  finishing,
  navigate = false,
  onSettled,
  onRefused,
  disabled,
  variant = "primary",
  size = "md",
  block,
  className = "",
  noticeAlign = "start",
  lock = true,
}: {
  request: Record<string, unknown>;
  children: ReactNode;
  successTitle?: string;
  /** The last step on the confirming sheet: "Booking your session". */
  finishing?: string;
  /** After success, go to the page the payment belongs to (a new booking's Home). */
  navigate?: boolean;
  /** After any end state (paid, refunded, pending): for a parent that closes a panel. */
  onSettled?: (state: PayState) => void;
  /**
   * Refused before any money moved (the slot went, payment is off). Given,
   * the parent shows it -- and can, say, reload the times; otherwise it is
   * shown under the button.
   */
  onRefused?: (refusal: NonNullable<PayState["refusal"]>) => void;
  disabled?: boolean;
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  block?: boolean;
  className?: string;
  noticeAlign?: "start" | "center";
  /** The padlock before the label: on for a primary pay button. */
  lock?: boolean;
}) {
  const router = useRouter();
  const { state, pay, reset } = usePayment();
  const working = state.phase === "starting" || state.phase === "open" || state.phase === "confirming";

  // Hand each refusal up exactly once, as it arrives -- a parent's inline
  // callback is a new function every render and must not fire it again.
  const refusal = state.refusal;
  const handed = useRef<PayState["refusal"]>(null);
  const onRefusedRef = useRef(onRefused);
  useEffect(() => {
    onRefusedRef.current = onRefused;
  });
  useEffect(() => {
    if (refusal && handed.current !== refusal) {
      handed.current = refusal;
      onRefusedRef.current?.(refusal);
    }
  }, [refusal]);

  const finish = () => {
    const snapshot = state;
    reset();
    onSettled?.(snapshot);
    if (navigate && snapshot.returnTo) router.push(snapshot.returnTo);
    router.refresh();
  };

  const align = noticeAlign === "center" ? "justify-center text-center" : "";

  return (
    <>
      <Button
        variant={variant}
        size={size}
        block={block}
        className={`relative overflow-hidden ${className}`}
        loading={state.phase === "starting" || state.phase === "confirming"}
        disabled={disabled || working}
        onClick={() => void pay(request)}
      >
        {state.phase === "open" ? (
          <>
            <span aria-hidden className="pay-live w-2 h-2 rounded-full bg-current opacity-80" />
            Waiting for Razorpay…
          </>
        ) : (
          <>
            {lock && variant === "primary" && state.phase !== "starting" && (
              <svg aria-hidden width="14" height="14" viewBox="0 0 20 20" fill="none" className="flex-none opacity-90">
                <rect x="4.5" y="9" width="11" height="8" rx="2" stroke="currentColor" strokeWidth="1.9" />
                <path d="M7 9V6.8a3 3 0 016 0V9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              </svg>
            )}
            {children}
          </>
        )}
        {/* While the checkout is being prepared, a thin light runs along the bottom edge. */}
        {state.phase === "starting" && (
          <span aria-hidden className="absolute inset-x-0 bottom-0 h-[3px] overflow-hidden">
            <span className="pay-bar block h-full w-[38%] bg-white/60 rounded-full" />
          </span>
        )}
      </Button>

      {refusal && !onRefused && (
        <span
          role="alert"
          className={`pay-swap flex items-start gap-2 t-small text-[var(--color-critical-text)] ${align}`}
        >
          <NoticeIcon tone="critical" />
          {refusal.message}
        </span>
      )}
      {state.notice && (
        <span
          role="status"
          className={`pay-swap flex items-start gap-2 t-small ${align} ${
            state.notice.tone === "caution" ? "text-[var(--color-caution-text)]" : "text-[var(--color-ink-2)]"
          }`}
        >
          <NoticeIcon tone={state.notice.tone} />
          {state.notice.text}
        </span>
      )}

      <PaymentSheet
        state={state}
        successTitle={successTitle}
        finishing={finishing}
        onContinue={finish}
        onClose={() => {
          const snapshot = state;
          reset();
          if (snapshot.phase !== "failed") {
            onSettled?.(snapshot);
            router.refresh();
          }
        }}
        onRetry={() => void pay(request)}
      />
    </>
  );
}

function NoticeIcon({ tone }: { tone: "info" | "caution" | "critical" }) {
  const colour =
    tone === "critical" ? "var(--color-critical)" : tone === "caution" ? "var(--color-caution)" : "var(--color-ink-3)";
  return (
    <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none" className="flex-none mt-[3px]">
      <circle cx="8" cy="8" r="6.5" stroke={colour} strokeWidth="1.6" />
      <path d="M8 4.8v3.8M8 11.1v.1" stroke={colour} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Under a pay button: that it is Razorpay, and the ways people can pay. Words
 * rather than card-network logos, which would need their owners' permission.
 *
 * `align`: under the button's left edge, centred under it, or "end" -- right
 * under a button that sits on the right of a row (from sm), and left on a
 * phone, where the button stacks under what it pays for.
 */
export function PaymentTrust({ align = "start" }: { align?: "start" | "center" | "end" }) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-2 t-small text-[var(--color-ink-3)] ${
        align === "center" ? "justify-center" : align === "end" ? "sm:justify-end" : ""
      }`}
    >
      <span className="inline-flex items-center gap-[6px]">
        <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 1.8l5 2v3.6c0 3.1-2.1 5.6-5 6.8-2.9-1.2-5-3.7-5-6.8V3.8l5-2z"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path
            d="M5.8 8.1l1.6 1.6 3-3.3"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Secured by Razorpay
      </span>
      <span className="inline-flex flex-wrap gap-[6px]">
        {["UPI", "Cards", "Net banking", "Wallets"].map((m) => (
          <span
            key={m}
            className="px-2 py-[2px] rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] text-[11.5px] leading-[1.5] text-[var(--color-ink-2)]"
          >
            {m}
          </span>
        ))}
      </span>
    </div>
  );
}
