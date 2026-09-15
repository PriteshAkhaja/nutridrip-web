"use client";

import { useId, type ReactNode } from "react";

/**
 * A switch, for a setting that takes effect as it stands rather than on save.
 *
 * Distinct from `Checkbox` on purpose. A checkbox answers a question on a form
 * — "include session kits", "share with the nurse now" — and means nothing
 * until the form is submitted. A switch reads as a thing being on or off right
 * now, which is what a standing setting is.
 *
 * It is still a real `<input type="checkbox">` underneath, with `role="switch"`
 * so a screen reader announces it as on or off rather than checked. Painting a
 * div to look like a switch loses the keyboard, the label association and the
 * form semantics, and all three would have to be rebuilt worse.
 */
export function Switch({
  label,
  hint,
  checked,
  onChange,
  disabled,
  name,
}: {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
}) {
  const id = useId();

  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-3 min-h-[44px] ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      }`}
    >
      {/* The off track is a solid mid grey, not the near-white surface tint:
          a white knob on a near-white track is invisible, which is the state
          somebody most needs to be able to read at a glance. */}
      <span className="relative inline-flex flex-none items-center mt-[2px]">
        <input
          id={id}
          name={name}
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        {/* The track. `peer-focus-visible` rather than `peer-focus`, so the
            ring appears for a keyboard and not on every mouse click. */}
        <span
          aria-hidden="true"
          className={`block w-[44px] h-[26px] rounded-full transition-colors duration-150 ease-out peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--color-primary)] ${
            checked ? "bg-[var(--color-primary)]" : "bg-[var(--color-line-2)]"
          }`}
        />
        {/* The knob, riding on top of the track. */}
        <span
          aria-hidden="true"
          className={`absolute top-[3px] left-[3px] w-[20px] h-[20px] rounded-full bg-white transition-transform duration-150 ease-out ${
            checked ? "translate-x-[18px]" : "translate-x-0"
          }`}
          style={{ boxShadow: "0 1px 3px rgba(16,24,32,0.32)" }}
        />
      </span>

      <span className="flex flex-col gap-[2px] min-w-0">
        <span className="t-body font-medium">{label}</span>
        {hint ? <span className="t-small text-[var(--color-ink-3)]">{hint}</span> : null}
      </span>
    </label>
  );
}
