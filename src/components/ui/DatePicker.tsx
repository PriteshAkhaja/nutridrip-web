"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * A calendar that belongs to this product rather than to Chrome.
 *
 * A native `<input type="date">` draws its popup outside the document — no
 * selector reaches it, no token applies — so the one control that opens a panel
 * of its own was the one panel wearing somebody else's blue. This is the same
 * trade `SelectMenu` makes, and for the same reason.
 *
 * Two things it refuses to give up to get there:
 *
 * 1. **Typing still works.** The field is a real text input, not a button that
 *    opens a calendar. Typing `16-09-2026` is faster than paging a grid, and
 *    for a date of birth it is the only sane route. A picker that can only be
 *    clicked is a downgrade dressed as a polish.
 * 2. **The native control still ships.** It is what renders on the server, on a
 *    touch device, and whenever JavaScript has not run. A phone's wheel picker
 *    beats any popup a page can draw, and a date field that needs a bundle
 *    before it accepts a date is worse than an unstyled one.
 *
 * Keyboard follows the ARIA Authoring Practices date picker dialog: arrows by
 * day, Home/End for the week, PageUp/PageDown by month, shifted by year,
 * Enter/Space to choose, Escape to close, roving tabindex across the grid, and
 * focus returned to the field.
 */

const WEEKDAYS = [
  { short: "Mo", full: "Monday" },
  { short: "Tu", full: "Tuesday" },
  { short: "We", full: "Wednesday" },
  { short: "Th", full: "Thursday" },
  { short: "Fr", full: "Friday" },
  { short: "Sa", full: "Saturday" },
  { short: "Su", full: "Sunday" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Dates are built and read field by field, never through `new Date(iso)`. That
 * parser treats a bare `YYYY-MM-DD` as UTC, so in IST it lands at 05:30 the day
 * before — a session recorded late in the evening would file itself against
 * yesterday.
 */
export const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export const fromISO = (s: string | undefined | null): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s ?? "");
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  if (mo < 0 || mo > 11 || day < 1 || day > 31) return null;
  const d = new Date(y, mo, day);
  // Rejects the 31st of a 30-day month rather than silently rolling it over.
  return d.getMonth() === mo && d.getDate() === day ? d : null;
};

/** en-IN reads dd-mm-yyyy, which is what the native control shows here too. */
export const display = (s: string | undefined | null) => {
  const d = fromISO(s);
  return d
    ? `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`
    : "";
};

/**
 * Accepts what people actually type: `16-09-2026`, `16/09/2026`, `16.9.2026`,
 * `1692026` is not a date and is refused. Returns ISO, or "" if it is not a
 * whole valid date yet — a half-typed field is not an error, it is unfinished.
 */
export const parseTyped = (raw: string): string | "" => {
  const m = /^(\d{1,2})[-/. ](\d{1,2})[-/. ](\d{4})$/.exec(raw.trim());
  if (!m) return "";
  const candidate = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return fromISO(candidate) ? candidate : "";
};

export const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export const addMonths = (d: Date, n: number) => {
  const target = new Date(d.getFullYear(), d.getMonth() + n, 1);
  // Clamp rather than overflow: 31 Mar back one month is 28 Feb, not 3 Mar.
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(d.getDate(), last));
};

/**
 * The month and year in the panel heading. Sized to their own text, with the
 * hover a select earns for being clickable — the native arrow is kept, the
 * same call `Select` in Field.tsx makes.
 */
const HEADING_SELECT =
  "t-body text-[var(--color-ink)] bg-transparent border-0 outline-none " +
  "cursor-pointer rounded-[var(--radius-sm)] py-[3px] pl-[5px] pr-0 max-w-[110px] " +
  "hover:bg-[var(--color-surface-2)] focus-visible:bg-[var(--color-surface-2)]";

/** Monday-first, matching how a week is written here. */
const mondayIndex = (d: Date) => (d.getDay() + 6) % 7;

export type DatePickerProps = {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  /** Inclusive bounds, ISO. Out-of-range days are shown but not choosable. */
  min?: string;
  max?: string;
  disabled?: boolean;
  required?: boolean;
  /** Offer Clear in the footer. Off for a field that must hold a date. */
  clearable?: boolean;
  /**
   * What an empty field says. The default asks for the thing rather than
   * spelling out a mask: typing accepts `-`, `/`, `.` and spaces, so a rigid
   * `dd-mm-yyyy` promised a precision the parser does not actually require.
   */
  placeholder?: string;
};

export function DatePicker({
  label,
  hint,
  error,
  value,
  onChange,
  min,
  max,
  disabled,
  required,
  clearable = true,
  placeholder = "Select a date",
}: DatePickerProps) {
  /**
   * False through SSR and the first client render, so the markup the server
   * sent is the markup React hydrates. The upgrade happens in an effect, the
   * only place allowed to ask what kind of device this is.
   */
  const [{ enhanced, today }, setBrowser] = useState({ enhanced: false, today: "" });
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const [cursor, setCursor] = useState<Date>(() => fromISO(value) ?? new Date());
  const [focused, setFocused] = useState<string>(value || "");
  /**
   * What is in the box while it is being typed in. `null` means "nothing is
   * being typed, show the value" — so a value that changes underneath the
   * component (a URL filter, a form reset) is picked up by deriving the text
   * rather than by an effect racing to copy it into state.
   */
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? display(value);

  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const id = useId();

  /**
   * Both reads have to happen here and nowhere else. Asking for the pointer
   * type during render would make the server and the browser disagree about
   * which control to draw, and reading the clock during render would make them
   * disagree about which cell is today — each of those is a hydration error.
   * The rule below is about avoiding cascading renders; this runs once on
   * mount and is the documented way to adopt a browser capability.
   */
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBrowser({
      enhanced: !window.matchMedia("(pointer: coarse)").matches,
      today: iso(new Date()),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // A 150px filter field sits anywhere on the row; a 292px panel hanging off
  // its left edge can leave the screen. Measured on open, not guessed.
  useEffect(() => {
    if (!open || !wrapRef.current) return;
    const box = wrapRef.current.getBoundingClientRect();
    setAlignRight(box.left + 292 > window.innerWidth - 8);
  }, [open]);

  // Move the DOM focus with the roving cell so a screen reader follows along.
  useEffect(() => {
    if (!open) return;
    gridRef.current?.querySelector<HTMLElement>(`[data-iso="${focused}"]`)?.focus();
  }, [open, focused]);

  const outOfRange = (s: string) => Boolean((min && s < min) || (max && s > max));

  const openPanel = () => {
    const start = fromISO(value) ?? fromISO(today) ?? new Date();
    setCursor(start);
    setFocused(value || iso(start));
    setOpen(true);
  };

  const close = (restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) inputRef.current?.focus();
  };

  const choose = (s: string) => {
    if (!s || outOfRange(s)) return;
    onChange(s);
    setDraft(null);
    close();
  };

  const moveFocus = (next: Date) => {
    setFocused(iso(next));
    if (next.getMonth() !== cursor.getMonth() || next.getFullYear() !== cursor.getFullYear()) {
      setCursor(next);
    }
  };

  /** Committed on blur and on Enter, not on every keystroke — half of
   *  "16-09-2026" is "16-09-20", a real date nobody meant to pick. */
  const commitDraft = () => {
    const trimmed = text.trim();
    if (trimmed === "") {
      if (value) onChange("");
      setDraft(null);
      return;
    }
    const parsed = parseTyped(trimmed);
    setDraft(null);
    if (parsed && !outOfRange(parsed)) {
      onChange(parsed);
    }
    // Anything unparseable or out of bounds simply falls back to showing the
    // last good value, because clearing the draft re-derives the text.
  };

  const onGridKey = (e: React.KeyboardEvent) => {
    const base = fromISO(focused) ?? cursor;
    const jump = (n: number) => {
      e.preventDefault();
      moveFocus(addDays(base, n));
    };
    switch (e.key) {
      case "ArrowLeft": jump(-1); break;
      case "ArrowRight": jump(1); break;
      case "ArrowUp": jump(-7); break;
      case "ArrowDown": jump(7); break;
      case "Home": jump(-mondayIndex(base)); break;
      case "End": jump(6 - mondayIndex(base)); break;
      case "PageUp":
        e.preventDefault();
        moveFocus(addMonths(base, e.shiftKey ? -12 : -1));
        break;
      case "PageDown":
        e.preventDefault();
        moveFocus(addMonths(base, e.shiftKey ? 12 : 1));
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(focused);
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
      default:
        break;
    }
  };

  // Native until proven otherwise — see `enhanced` above.
  if (!enhanced) {
    /*
     * The platform's picker, in this product's field. Left as a bare
     * `<input type="date">`, Android draws an empty one as a blank box with a
     * chevron — no placeholder, no calendar, nothing to say it holds a date —
     * and desktop Chrome draws a mask the enhanced field then replaces, so the
     * control visibly changed shape as the page hydrated.
     *
     * So the field is drawn here, identically to the enhanced one, and the real
     * date input lies over all of it, transparent. A tap anywhere lands on it
     * and opens the phone's own picker; the value, min and max are still the
     * browser's to enforce. 16px on the hidden input stops iOS zooming the page
     * when it takes focus.
     */
    return (
      <div className="flex flex-col gap-[7px] min-w-0">
        {label && (
          <span className="flex items-baseline justify-between gap-3">
            <label htmlFor={`${id}-native`} className="t-micro">{label}</label>
            {hint && <span className="t-small text-[var(--color-ink-3)]">{hint}</span>}
          </span>
        )}
        <div
          className={`relative min-h-[44px] w-full pl-[14px] pr-[6px] rounded-[var(--radius-sm)] border bg-[var(--color-surface)] flex items-center gap-1 transition-colors duration-150 ease-out ${
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
            } ${disabled ? "text-[var(--color-ink-3)]" : ""}`}
          >
            {value ? display(value) : placeholder}
          </span>
          <span aria-hidden className="flex-none w-[32px] h-[32px] flex items-center justify-center text-[var(--color-ink-3)]">
            <CalendarGlyph />
          </span>
          <input
            id={`${id}-native`}
            type="date"
            value={value}
            min={min}
            max={max}
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

  // Six rows always. A month that fits in five would otherwise change the
  // panel's height as you page through it, walking the footer up and down
  // under the pointer.
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = addDays(first, -mondayIndex(first));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));

  // Wide enough for a date of birth without paging a hundred times, bounded by
  // min/max where the caller gave them.
  const thisYear = fromISO(today)?.getFullYear() ?? new Date().getFullYear();
  const firstYear = fromISO(min)?.getFullYear() ?? thisYear - 100;
  const lastYear = fromISO(max)?.getFullYear() ?? thisYear + 15;
  const years = Array.from({ length: Math.max(1, lastYear - firstYear + 1) }, (_, i) => firstYear + i);

  return (
    <div
      ref={wrapRef}
      className="relative flex flex-col gap-[7px] min-w-0"
      // Tab out of the panel and it should go away. Checked on the next tick
      // because focus is briefly on nothing while it moves between elements.
      onBlur={(e) => {
        if (!open) return;
        const next = e.relatedTarget as Node | null;
        if (next && wrapRef.current?.contains(next)) return;
        setOpen(false);
      }}
    >
      {label && (
        <span className="flex items-baseline justify-between gap-3">
          <span className="t-micro" id={`${id}-label`}>{label}</span>
          {hint && <span className="t-small text-[var(--color-ink-3)]">{hint}</span>}
        </span>
      )}

      {/* The whole field opens the calendar, not just the glyph — the box is
          what reads as the control, and hunting a 32px target inside it is a
          worse version of the same click. Opening rather than toggling: a
          click into the text to correct a digit must not shut the panel. */}
      <div
        onClick={() => {
          if (disabled || open) return;
          inputRef.current?.focus();
          openPanel();
        }}
        className={`min-h-[44px] w-full pl-[14px] pr-[6px] rounded-[var(--radius-sm)] border bg-[var(--color-surface)] flex items-center gap-1 transition-colors duration-150 ease-out ${
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
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          aria-labelledby={label ? `${id}-label` : undefined}
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
            } else if (e.key === "Escape" && open) {
              e.preventDefault();
              close();
            } else if (e.key === "ArrowDown" && !open) {
              e.preventDefault();
              openPanel();
            }
          }}
          className={`flex-1 min-w-0 bg-transparent border-0 outline-none cursor-pointer text-[14.5px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-3)] disabled:text-[var(--color-ink-3)] ${
            // Mono is for the figure, not for the hint about the figure: an
            // empty field shows its format in the prose face, at prose weight,
            // so it reads as a note rather than as a value already entered.
            text ? "t-data" : "font-normal"
          }`}
        />
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={open ? "Close calendar" : "Open calendar"}
          // Stops the wrapper's opener seeing this click too, so the glyph can
          // still close a panel the rest of the field only ever opens.
          onClick={(e) => { e.stopPropagation(); if (open) close(); else openPanel(); }}
          className="flex-none w-[32px] h-[32px] rounded-[var(--radius-sm)] flex items-center justify-center cursor-pointer text-[var(--color-ink-3)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-primary)] disabled:cursor-default disabled:hover:bg-transparent"
        >
          <CalendarGlyph />
        </button>
      </div>

      {error && <span className="t-small text-[var(--color-critical-text)]">{error}</span>}

      {open && (
        <div
          role="dialog"
          aria-label={`Choose a date${typeof label === "string" ? ` for ${label}` : ""}`}
          className={`absolute top-full z-30 mt-1 w-[292px] p-[14px] rounded-[var(--radius-md)] border border-[var(--color-line-2)] bg-[var(--color-surface)] shadow-[var(--shadow-pop)] ${
            alignRight ? "right-0" : "left-0"
          }`}
        >
          {/* A month and a year are exactly the "short options, nothing to
              explain" case SelectMenu's own note reserves for a native select,
              and they turn a date of birth from a hundred clicks into two. */}
          {/* Both selects size to their own text and sit together as one
              phrase — "September 2026". Stretching the month to fill the row
              pushed its arrow to the far right, which read as two unrelated
              controls rather than one heading. The steppers take the slack. */}
          <div className="flex items-center gap-[2px] mb-[10px]">
            <select
              aria-label="Month"
              value={cursor.getMonth()}
              onChange={(e) => setCursor(new Date(cursor.getFullYear(), Number(e.target.value), 1))}
              className={`${HEADING_SELECT} font-semibold`}
            >
              {MONTHS.map((m, i) => <option key={m} value={i}>{m}</option>)}
            </select>
            <select
              aria-label="Year"
              value={cursor.getFullYear()}
              onChange={(e) => setCursor(new Date(Number(e.target.value), cursor.getMonth(), 1))}
              className={`${HEADING_SELECT} t-data font-medium`}
            >
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <span className="flex gap-1 ml-auto flex-none pl-2">
              <Step label="Previous month" onClick={() => setCursor(addMonths(cursor, -1))} d="M10 3L5.5 8l4.5 5" />
              <Step label="Next month" onClick={() => setCursor(addMonths(cursor, 1))} d="M6 3l4.5 5L6 13" />
            </span>
          </div>

          {/* Screen readers hear the month change without it stealing focus. */}
          <span className="sr-only" aria-live="polite">
            {MONTHS[cursor.getMonth()]} {cursor.getFullYear()}
          </span>

          <div role="grid" aria-label="Calendar" ref={gridRef} onKeyDown={onGridKey}>
            <div role="row" className="grid grid-cols-7 mb-[6px]">
              {WEEKDAYS.map((d) => (
                <abbr
                  key={d.short}
                  role="columnheader"
                  title={d.full}
                  aria-label={d.full}
                  className="t-small text-center text-[var(--color-ink-3)] font-medium no-underline"
                >
                  {d.short}
                </abbr>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-y-[2px]">
              {cells.map((d) => {
                const s = iso(d);
                const otherMonth = d.getMonth() !== cursor.getMonth();
                const selected = s === value;
                const isToday = s === today;
                const blocked = outOfRange(s);
                return (
                  <button
                    key={s}
                    type="button"
                    role="gridcell"
                    data-iso={s}
                    tabIndex={s === focused ? 0 : -1}
                    aria-selected={selected}
                    aria-current={isToday ? "date" : undefined}
                    aria-disabled={blocked || undefined}
                    aria-label={`${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`}
                    onClick={() => choose(s)}
                    className={`h-[34px] rounded-[var(--radius-sm)] t-data text-[13px] transition-colors duration-100 ${
                      blocked
                        ? "text-[var(--color-line-2)] cursor-not-allowed"
                        : "cursor-pointer hover:bg-[var(--color-primary-soft)]"
                    } ${
                      selected
                        ? "bg-[var(--color-primary)] text-white font-semibold hover:bg-[var(--color-primary)]"
                        : otherMonth
                          ? "text-[var(--color-ink-3)] opacity-55"
                          : "text-[var(--color-ink)]"
                    }`}
                    // Today is a position, not a status, so it gets a ring
                    // rather than one of the clinical hues.
                    style={
                      isToday && !selected
                        ? { boxShadow: "inset 0 0 0 1.5px var(--color-primary-line)" }
                        : undefined
                    }
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 mt-[10px] pt-[10px] border-t border-[var(--color-line)]">
            {clearable ? (
              <button
                type="button"
                onClick={() => { onChange(""); setDraft(null); close(); }}
                className="t-small font-semibold text-[var(--color-ink-2)] cursor-pointer hover:text-[var(--color-ink)]"
              >
                Clear
              </button>
            ) : <span />}
            <button
              type="button"
              disabled={!today || outOfRange(today)}
              onClick={() => choose(today)}
              className="t-small font-semibold text-[var(--color-primary)] cursor-pointer disabled:text-[var(--color-ink-3)] disabled:cursor-not-allowed"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Step({ label, onClick, d }: { label: string; onClick: () => void; d: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="w-[28px] h-[28px] rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink-2)] flex items-center justify-center cursor-pointer hover:bg-[var(--color-surface-2)] hover:border-[var(--color-line-2)]"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d={d} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function CalendarGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="2.5" width="13" height="12" rx="2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M1.5 6h13" stroke="currentColor" strokeWidth="1.2" />
      <path d="M5 1.5v2M11 1.5v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
