"use client";

import { useRef } from "react";

/**
 * Six single-character boxes for a six-digit code.
 *
 * Six boxes rather than one wide field on purpose: the shape of the input
 * tells you how much to type, so it needs no placeholder — and a placeholder
 * of "000000" reads as six zeros already entered, which is worse than nothing.
 *
 * Shared by the sign-in screen and the nurse's prescription unlock, so a code
 * is typed the same way wherever it is asked for.
 */
export function OtpBoxes({
  value,
  onChange,
  autoFocus = false,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  const setDigit = (i: number, digit: string) => {
    const next = value.split("");
    next[i] = digit;
    onChange(next.join("").slice(0, 6));
    if (digit && i < 5) refs.current[i + 1]?.focus();
  };

  return (
    <div className="flex gap-2" role="group" aria-label="Six digit code">
      {Array.from({ length: 6 }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          maxLength={1}
          value={value[i] ?? ""}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1}`}
          onChange={(e) => setDigit(i, e.target.value.replace(/\D/g, ""))}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus();
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
            if (pasted) {
              e.preventDefault();
              onChange(pasted);
              refs.current[Math.min(pasted.length, 5)]?.focus();
            }
          }}
          className="w-11 h-[52px] text-center rounded-[var(--radius-sm)] border border-[var(--color-line-2)] bg-[var(--color-surface)] text-[18px] focus:border-[var(--color-primary)]"
          style={{ fontFamily: "var(--font-mono)", fontWeight: 500 }}
        />
      ))}
    </div>
  );
}
