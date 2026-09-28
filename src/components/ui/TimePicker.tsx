"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useClockFormat } from "@/components/ClockProvider";
import { clockOf, type ClockFormat } from "@/lib/time";

/**
 * A time field that belongs to this product rather than to the browser — the
 * companion to DatePicker, and built on the same two refusals:
 *
 * 1. **Typing still works.** "17:00", "5pm", "5:30 pm", "1730" and "9.15" all
 *    land. Picking from a panel is the slow route for someone who knows the
 *    time.
 * 2. **The native control still ships** on touch devices and before
 *    JavaScript runs: a phone's time wheel beats any popup a page can draw.
 *
 * On a pointer device the panel is three columns — hour, minute, AM/PM — in
 * this product's colours, or two (hours 00–23) when the super admin has set
 * the 24-hour clock (Admin → Settings). The value is always "HH:MM", 24-hour,
 * which is what the server stores and compares; only what is shown changes.
 */

/** "17:05" → { h: 17, m: 5 }, or null. */
export function parseHHMM(v: string | null | undefined): { h: number; m: number } | null {
  const x = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(v ?? "");
  return x ? { h: Number(x[1]), m: Number(x[2]) } : null;
}

export const toHHMM = (h: number, m: number) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

/** "17:05" → "5:05 PM"; "00:30" → "12:30 AM". Empty for anything that is not a time. */
export function formatTime12(v: string | null | undefined): string {
  const t = parseHHMM(v);
  if (!t) return "";
  const period = t.h < 12 ? "AM" : "PM";
  const h12 = t.h % 12 === 0 ? 12 : t.h % 12;
  return `${h12}:${String(t.m).padStart(2, "0")} ${period}`;
}

/**
 * What people type, to "HH:MM", or "" if it is not a whole time yet.
 * With AM/PM the hour is 1–12; without, it is read as 24-hour.
 */
export function parseTypedTime(raw: string): string {
  const s = raw.trim().toLowerCase().replace(/\s+/g, " ");
  const m = /^(\d{1,2})(?:[:. ]?(\d{2}))?\s*(a|am|a\.m\.|p|pm|p\.m\.)?$/.exec(s);
  if (!m) return "";
  let h = Number(m[1]);
  const min = m[2] === undefined ? 0 : Number(m[2]);
  if (min > 59) return "";
  const ampm = m[3]?.startsWith("a") ? "am" : m[3]?.startsWith("p") ? "pm" : null;
  if (ampm) {
    if (h < 1 || h > 12) return "";
    h = (h % 12) + (ampm === "pm" ? 12 : 0);
  } else if (h > 23) {
    return "";
  }
  return toHHMM(h, min);
}

/** 12 → 12 AM/PM ordering: 12, 1, 2 … 11, as a clock face is read. */
const HOURS_12 = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const HOURS_24 = Array.from({ length: 24 }, (_, h) => h);

export type TimePickerProps = {
  label?: ReactNode;
  /** For a field with no visible label, e.g. "Monday from". */
  ariaLabel?: string;
  hint?: ReactNode;
  error?: string;
  /** "HH:MM", 24-hour, or "". */
  value: string;
  onChange: (value: string) => void;
  /** Inclusive bounds, "HH:MM". Times outside are shown but cannot be chosen. */
  min?: string;
  max?: string;
  /** Minutes between the choices in the panel. Typing is not held to it. */
  step?: number;
  disabled?: boolean;
  required?: boolean;
  clearable?: boolean;
  placeholder?: string;
  /** "sm" for a field sitting in a row of them. */
  size?: "md" | "sm";
  /** 12- or 24-hour. Defaults to the platform setting; pass it only to override. */
  format?: ClockFormat;
};

export function TimePicker({
  label,
  ariaLabel,
  hint,
  error,
  value,
  onChange,
  min,
  max,
  step = 15,
  disabled,
  required,
  clearable = false,
  placeholder = "Select a time",
  size = "md",
  format,
}: TimePickerProps) {
  const platformFormat = useClockFormat();
  const fmt = format ?? platformFormat;
  const shown = (v: string) => clockOf(v, fmt);
  // Native until the browser has said what kind of device this is — the same
  // hydration-safe upgrade DatePicker makes.
  const [enhanced, setEnhanced] = useState(false);
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  /** Opens above the field when there is not room for it below. */
  const [dropUp, setDropUp] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? (parseHHMM(value) ? shown(value) : "");

  const wrapRef = useRef<HTMLDivElement>(null);
  /** The field itself: the panel is placed against it, not against the label or the error. */
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const id = useId();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnhanced(!window.matchMedia("(pointer: coarse)").matches);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    // Escape closes it wherever the focus is -- after a click on a part of the
    // panel that takes no focus, it is on nothing at all.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setOpen(false);
      inputRef.current?.focus();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Measured on open, so a field near the right edge opens its panel leftwards.
  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    // Placed where it fits, measured before paint so it never flashes in the
    // wrong place first: leftwards near the right edge, and upwards when the
    // field sits too low for the panel to open below it.
    const box = anchorRef.current.getBoundingClientRect();
    const height = panelRef.current?.offsetHeight ?? 300;
    const below = window.innerHeight - box.bottom;
    setAlignRight(box.left + 236 > window.innerWidth - 8);
    setDropUp(below < height + 12 && box.top > below);
  }, [open]);

  // Each column scrolls its chosen option into view as the panel opens.
  useEffect(() => {
    if (!open) return;
    // Scrolls the column only: scrollIntoView would move the page as well.
    panelRef.current?.querySelectorAll<HTMLElement>('[aria-selected="true"]').forEach((el) => {
      const list = el.parentElement;
      if (!list) return;
      const offset = el.getBoundingClientRect().top - list.getBoundingClientRect().top;
      list.scrollTop += offset - (list.clientHeight - el.offsetHeight) / 2;
    });
  }, [open]);

  const outOfRange = (v: string) => Boolean((min && v < min) || (max && v > max));
  const current = parseHHMM(value) ?? parseHHMM(min) ?? { h: 9, m: 0 };
  const period = current.h < 12 ? "AM" : "PM";
  const h12 = current.h % 12 === 0 ? 12 : current.h % 12;
  const every = Math.max(1, step);
  const stepped = Array.from({ length: Math.ceil(60 / every) }, (_, i) => i * every).filter((m) => m < 60);
  // A value between the steps (typed, or saved before) is still shown in the list.
  const minutes = stepped.includes(current.m) ? stepped : [...stepped, current.m].sort((a, b) => a - b);

  const compose = (hour12: number, minute: number, p: "AM" | "PM") =>
    toHHMM((hour12 % 12) + (p === "PM" ? 12 : 0), minute);

  const set = (v: string) => {
    if (outOfRange(v)) return;
    onChange(v);
    setDraft(null);
  };

  const openPanel = () => {
    if (disabled) return;
    setOpen(true);
  };
  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) inputRef.current?.focus();
  };

  const commitDraft = () => {
    const trimmed = text.trim();
    if (trimmed === "") {
      if (value && clearable) onChange("");
      setDraft(null);
      return;
    }
    const parsed = parseTypedTime(trimmed);
    setDraft(null);
    if (parsed && !outOfRange(parsed)) onChange(parsed);
  };

  /** Arrow keys move within a column; the buttons are real, so Tab moves between columns. */
  const onColumnKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not([disabled])")];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    const go = (n: number) => {
      e.preventDefault();
      items[Math.max(0, Math.min(items.length - 1, n))]?.focus();
    };
    if (e.key === "ArrowDown") go(i + 1);
    else if (e.key === "ArrowUp") go(i - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(items.length - 1);
    else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  const height = size === "sm" ? "min-h-[40px]" : "min-h-[44px]";

  if (!enhanced) {
    // The phone's own time wheel, laid transparently over this product's field.
    return (
      <div className="flex flex-col gap-[7px] min-w-0">
        {label && (
          <span className="flex items-baseline justify-between gap-3">
            <label htmlFor={`${id}-native`} className="t-micro">
              {label}
            </label>
            {hint && <span className="t-small text-[var(--color-ink-3)]">{hint}</span>}
          </span>
        )}
        <div
          className={`relative ${height} w-full pl-[14px] pr-[6px] rounded-[var(--radius-sm)] border bg-[var(--color-surface)] flex items-center gap-1 ${
            disabled ? "bg-[var(--color-surface-2)] border-[var(--color-line)]" : "cursor-pointer"
          } ${
            error
              ? "border-[var(--color-critical)] bg-[var(--color-critical-soft)]"
              : "border-[var(--color-line-2)] focus-within:border-[var(--color-primary)]"
          }`}
        >
          <span
            aria-hidden
            className={`flex-1 min-w-0 truncate text-[14.5px] ${
              value ? "t-data text-[var(--color-ink)]" : "font-normal text-[var(--color-ink-3)]"
            }`}
          >
            {value ? shown(value) : placeholder}
          </span>
          <span
            aria-hidden
            className="flex-none w-[32px] h-[32px] flex items-center justify-center text-[var(--color-ink-3)]"
          >
            <ClockGlyph />
          </span>
          <input
            id={`${id}-native`}
            type="time"
            aria-label={label ? undefined : ariaLabel}
            value={value}
            min={min}
            max={max}
            step={step * 60}
            disabled={disabled}
            required={required}
            aria-invalid={error ? true : undefined}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-[16px] disabled:cursor-default"
          />
        </div>
        {error && <span className="t-small text-[var(--color-critical-text)]">{error}</span>}
      </div>
    );
  }

  return (
    <div
      ref={wrapRef}
      className="relative flex flex-col gap-[7px] min-w-0"
      onBlur={(e) => {
        if (!open) return;
        const next = e.relatedTarget as Node | null;
        // Closed only when focus moves to something outside. Focus that goes
        // nowhere -- a button inside turning itself off (Previous at the first
        // allowed month), or a click on a part of the panel that takes no
        // focus -- is not leaving; a click outside closes it via mousedown.
        if (!next || wrapRef.current?.contains(next)) return;
        setOpen(false);
      }}
    >
      {label && (
        <span className="flex items-baseline justify-between gap-3">
          <span className="t-micro" id={`${id}-label`}>
            {label}
          </span>
          {hint && <span className="t-small text-[var(--color-ink-3)]">{hint}</span>}
        </span>
      )}

      <div ref={anchorRef} className="relative">
        <div
          onClick={() => {
            if (disabled || open) return;
            inputRef.current?.focus();
            openPanel();
          }}
          className={`${height} w-full pl-[14px] pr-[6px] rounded-[var(--radius-sm)] border bg-[var(--color-surface)] flex items-center gap-1 transition-colors duration-150 ease-out ${
            disabled ? "bg-[var(--color-surface-2)] border-[var(--color-line)]" : "cursor-pointer"
          } ${
            error
              ? "border-[var(--color-critical)] bg-[var(--color-critical-soft)]"
              : open
                ? "border-[var(--color-primary)]"
                : "border-[var(--color-line-2)]"
          }`}
        >
          <input
            ref={inputRef}
            type="text"
            autoComplete="off"
            placeholder={placeholder}
            aria-labelledby={label ? `${id}-label` : undefined}
            aria-label={label ? undefined : ariaLabel}
            aria-invalid={error ? true : undefined}
            disabled={disabled}
            required={required}
            value={text}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitDraft}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitDraft();
                if (open) close();
              } else if (e.key === "Escape" && open) {
                e.preventDefault();
                close();
              } else if (e.key === "ArrowDown" && !open) {
                e.preventDefault();
                openPanel();
              }
            }}
            className={`flex-1 min-w-0 w-full bg-transparent border-0 outline-none cursor-pointer text-[14.5px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)] disabled:text-[var(--color-ink-3)] ${
              text ? "t-data" : "font-normal"
            }`}
          />
          <button
            type="button"
            disabled={disabled}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label={open ? "Close time picker" : "Open time picker"}
            onClick={(e) => {
              e.stopPropagation();
              if (open) close();
              else openPanel();
            }}
            className="flex-none w-[32px] h-[32px] rounded-[var(--radius-sm)] flex items-center justify-center cursor-pointer text-[var(--color-ink-3)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-primary)] disabled:cursor-default disabled:hover:bg-transparent"
          >
            <ClockGlyph />
          </button>
        </div>

        {open && (
          <div
            ref={panelRef}
            role="dialog"
            // Escape from anywhere in the panel.
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                close();
              }
            }}
            aria-label={`Choose a time${typeof label === "string" ? ` for ${label}` : ariaLabel ? ` for ${ariaLabel}` : ""}`}
            className={`absolute z-30 ${dropUp ? "bottom-full mb-1" : "top-full mt-1"} w-[236px] p-[12px] rounded-[var(--radius-md)] border border-[var(--color-line-2)] bg-[var(--color-surface)] shadow-[var(--shadow-pop)] ${
              alignRight ? "right-0" : "left-0"
            }`}
          >
            <div className={`grid ${fmt === "24h" ? "grid-cols-2" : "grid-cols-[1fr_1fr_64px]"} gap-2`}>
              <Column label="Hour" onKeyDown={onColumnKey}>
                {fmt === "24h"
                  ? HOURS_24.map((h) => {
                      const v = toHHMM(h, current.m);
                      return (
                        <Option
                          key={h}
                          selected={Boolean(value) && h === current.h}
                          blocked={outOfRange(v)}
                          onClick={() => set(v)}
                        >
                          {String(h).padStart(2, "0")}
                        </Option>
                      );
                    })
                  : HOURS_12.map((h) => {
                      const v = compose(h, current.m, period);
                      return (
                        <Option
                          key={h}
                          selected={Boolean(value) && h === h12}
                          blocked={outOfRange(v)}
                          onClick={() => set(v)}
                        >
                          {h}
                        </Option>
                      );
                    })}
              </Column>
              <Column label="Minute" onKeyDown={onColumnKey}>
                {minutes.map((m) => {
                  const v = toHHMM(current.h, m);
                  return (
                    <Option
                      key={m}
                      selected={Boolean(value) && m === current.m}
                      blocked={outOfRange(v)}
                      onClick={() => set(v)}
                    >
                      {String(m).padStart(2, "0")}
                    </Option>
                  );
                })}
              </Column>
              {fmt === "12h" && (
                <Column label="AM or PM" onKeyDown={onColumnKey} scroll={false}>
                  {(["AM", "PM"] as const).map((p) => {
                    const v = compose(h12, current.m, p);
                    return (
                      <Option
                        key={p}
                        selected={Boolean(value) && p === period}
                        blocked={outOfRange(v)}
                        onClick={() => set(v)}
                      >
                        {p}
                      </Option>
                    );
                  })}
                </Column>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 mt-[10px] pt-[10px] border-t border-[var(--color-line)]">
              {clearable ? (
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setDraft(null);
                    close();
                  }}
                  className="t-small font-semibold text-[var(--color-ink-2)] cursor-pointer hover:text-[var(--color-ink)]"
                >
                  Clear
                </button>
              ) : (
                <span className="t-data text-[13px] text-[var(--color-ink-2)]">{value ? shown(value) : "—"}</span>
              )}
              <button
                type="button"
                onClick={() => {
                  // Choosing from an empty field starts at the shown time.
                  if (!value) set(toHHMM(current.h, current.m));
                  close();
                }}
                className="t-small font-semibold text-[var(--color-primary)] cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <span className="t-small text-[var(--color-critical-text)]">{error}</span>}
    </div>
  );
}

function Column({
  label,
  children,
  onKeyDown,
  scroll = true,
}: {
  label: string;
  children: ReactNode;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  scroll?: boolean;
}) {
  return (
    <div className="flex flex-col gap-[6px] min-w-0">
      <span className="t-small text-center text-[var(--color-ink-3)] font-medium">
        {label === "AM or PM" ? "\u00a0" : label}
      </span>
      <div
        role="listbox"
        aria-label={label}
        onKeyDown={onKeyDown}
        className={`flex flex-col gap-[2px] ${scroll ? "max-h-[196px] overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:var(--color-line-2)_transparent] pr-[2px]" : ""}`}
      >
        {children}
      </div>
    </div>
  );
}

function Option({
  selected,
  blocked,
  onClick,
  children,
}: {
  selected: boolean;
  blocked: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      disabled={blocked}
      onClick={onClick}
      // One state each, never two: the pale hover used to land on the chosen
      // option too and wash out its white figure.
      className={`h-[32px] flex-none rounded-[var(--radius-sm)] t-data text-[13px] transition-colors duration-100 ${
        selected
          ? "bg-[var(--color-primary)] text-white font-semibold cursor-pointer hover:bg-[var(--color-primary-dark)]"
          : blocked
            ? "text-[var(--color-line-2)] cursor-not-allowed"
            : "text-[var(--color-ink)] cursor-pointer hover:bg-[var(--color-primary-soft)]"
      }`}
    >
      {children}
    </button>
  );
}

function ClockGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
