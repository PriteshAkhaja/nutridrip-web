import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  ReactNode,
  WheelEvent,
} from "react";

const CONTROL =
  "min-h-[44px] w-full px-[14px] rounded-[var(--radius-sm)] border bg-[var(--color-surface)] " +
  "text-[14.5px] text-[var(--color-ink)] transition-colors duration-150 ease-out " +
  "placeholder:text-[var(--color-ink-3)] " +
  "disabled:bg-[var(--color-surface-2)] disabled:text-[var(--color-ink-3)] disabled:border-[var(--color-line)]";

function borderFor(error?: string) {
  return error
    ? "border-[var(--color-critical)] bg-[var(--color-critical-soft)]"
    : "border-[var(--color-line-2)] focus:border-[var(--color-primary)]";
}

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <span className="flex items-baseline justify-between gap-3">
      <span className="t-micro">{children}</span>
      {hint && <span className="t-small text-[var(--color-ink-3)]">{hint}</span>}
    </span>
  );
}

export function Field({
  label,
  hint,
  error,
  children,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-[7px] min-w-0">
      {label && <Label hint={hint}>{label}</Label>}
      {children}
      {error && <span className="t-small text-[var(--color-critical-text)]">{error}</span>}
    </label>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  /** Clinical data — doses, phone numbers, batch codes — is monospaced. */
  mono?: boolean;
};

export function Input({ label, hint, error, mono, className = "", ...rest }: InputProps) {
  /**
   * A number input changes its value when the wheel is scrolled over it. That
   * is the browser's default, and on these forms it is a quiet data error: you
   * scroll the page, the pointer happens to rest on "Quantity", and the number
   * of vials received changes with nothing on screen to say so.
   *
   * Blurring on wheel hands the scroll back to the page and leaves the number
   * alone. Arrow keys and typing still work, so nothing is taken away.
   */
  const guardWheel =
    rest.type === "number"
      ? (e: WheelEvent<HTMLInputElement>) => e.currentTarget.blur()
      : undefined;

  return (
    <Field label={label} hint={hint} error={error}>
      <input
        {...rest}
        onWheel={rest.onWheel ?? guardWheel}
        aria-invalid={error ? true : undefined}
        className={`${CONTROL} ${borderFor(error)} ${
          mono ? "font-[var(--font-mono)] font-medium tabular-nums" : ""
        } ${className}`}
      />
    </Field>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
};

export function Select({ label, hint, error, className = "", children, ...rest }: SelectProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      <select {...rest} className={`${CONTROL} ${borderFor(error)} cursor-pointer ${className}`}>
        {children}
      </select>
    </Field>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
};

export function Textarea({ label, hint, error, className = "", rows = 4, ...rest }: TextareaProps) {
  return (
    <Field label={label} hint={hint} error={error}>
      <textarea
        {...rest}
        rows={rows}
        className={`${CONTROL} ${borderFor(error)} py-3 min-h-[96px] leading-[1.55] resize-y ${className}`}
      />
    </Field>
  );
}

export function Checkbox({
  label,
  checked,
  onChange,
  name,
  disabled,
}: {
  label: ReactNode;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
  name?: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
      <input
        type="checkbox"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
        className="w-[18px] h-[18px] accent-[var(--color-primary)] cursor-pointer"
      />
      <span className="t-body">{label}</span>
    </label>
  );
}
