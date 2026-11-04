"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { CONTROL, Label, borderFor } from "./Field";

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
};

/**
 * A password field with a button that shows what was typed, so somebody can
 * check it before a failed sign-in rather than after. Hidden until asked.
 *
 * Not built on <Field>: that is a <label> around the input, and a button
 * inside a label is invalid and can take the label's name. Here the label
 * points at the input by id instead. Edge draws its own reveal button inside
 * password fields; it is hidden so there is only this one.
 */
export function PasswordInput({ label, hint, error, className = "", id, disabled, ...rest }: PasswordInputProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const [shown, setShown] = useState(false);

  return (
    <div className="flex flex-col gap-[7px] min-w-0">
      {label && (
        <label htmlFor={inputId}>
          <Label hint={hint}>{label}</Label>
        </label>
      )}
      <div className="relative">
        <input
          {...rest}
          id={inputId}
          type={shown ? "text" : "password"}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          className={`${CONTROL} ${borderFor(error)} pr-12 [&::-ms-reveal]:hidden ${className}`}
        />
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          disabled={disabled}
          aria-controls={inputId}
          aria-label={shown ? "Hide password" : "Show password"}
          title={shown ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 w-11 inline-flex items-center justify-center rounded-r-[var(--radius-sm)] text-[var(--color-ink-3)] cursor-pointer transition-colors duration-150 hover:text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-primary)] disabled:cursor-not-allowed disabled:hover:text-[var(--color-ink-3)]"
        >
          <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
            focusable="false"
          >
            <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
            <circle cx="12" cy="12" r="3" />
            {/* Struck through once the password is showing: the button now hides it. */}
            {shown && <path d="M4 4l16 16" />}
          </svg>
        </button>
      </div>
      {error && <span className="t-small text-[var(--color-critical-text)]">{error}</span>}
    </div>
  );
}
