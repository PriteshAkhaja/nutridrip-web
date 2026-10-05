"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * A dropdown for choices that each carry a reason.
 *
 * Closed it is one row, like any select — so a list of thirty nurses costs the
 * same page height as a list of two. Open, each row is as tall as it needs to
 * be and the reason wraps under the name.
 *
 * It exists because a native `<select>` cannot do the second half: an
 * `<option>` is plain text that will not wrap and cannot be styled, so a long
 * one is simply cut off — and what gets cut is the reason, which is the whole
 * point of showing it. A list of radio rows solved that but cost a screenful
 * of height per choice.
 *
 * Keep using `Select` for short options — a status, a month, a decline reason.
 * A native dropdown is better on a phone when there is nothing to explain.
 *
 * Keyboard and screen readers are handled rather than reimplemented badly:
 * combobox/listbox roles, arrow keys, Home/End, Enter, Escape, click-outside,
 * and focus returned to the button on close.
 *
 * Placed where it fits, as DatePicker and TimePicker are: below the button,
 * or above it when the button sits too low for the list to open downwards --
 * and never taller than the room on that side.
 */

/** The list's height when there is room for all of it. */
const LIST_MAX = 300;
/** Never squeezed below this: a few rows, still scrollable. */
const LIST_MIN = 160;
/** Kept clear of the window's edge. */
const EDGE = 12;

export type Choice = {
  value: string;
  label: string;
  /**
   * The reason, in pieces. Rendered so a wrap can only fall BETWEEN pieces —
   * "0" on one line and "km" on the next is not a measurement any more.
   */
  detail?: string[];
  /** Drawn in the caution tint: still choosable, but worth a second look. */
  warn?: boolean;
};

/**
 * The reason, in pieces, wrapping only between themselves.
 *
 * Defined at module scope rather than inside SelectMenu: a component declared
 * during render is a new type on every render, so React unmounts and remounts
 * the whole subtree instead of updating it.
 */
function Detail({ bits, warn, clamp }: { bits: string[]; warn?: boolean; clamp?: boolean }) {
  return (
    <span className={`flex gap-x-[6px] ${clamp ? "overflow-hidden flex-nowrap" : "flex-wrap"}`}>
      {bits.map((bit, i) => (
        <span
          key={bit}
          className="t-small whitespace-nowrap"
          style={{ color: warn ? "var(--color-caution-text)" : "var(--color-ink-3)" }}
        >
          {bit}
          {i < bits.length - 1 && (
            <span aria-hidden="true" className="ml-[6px] text-[var(--color-line-2)]">
              ·
            </span>
          )}
        </span>
      ))}
    </span>
  );
}

export function SelectMenu({
  label,
  hint,
  value,
  onChange,
  options,
}: {
  label: ReactNode;
  hint?: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: Choice[];
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  /** Opens above the button when there is not room for it below. */
  const [dropUp, setDropUp] = useState(false);
  const [maxHeight, setMaxHeight] = useState(LIST_MAX);
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  /** The list has just opened: its chosen row is brought to the middle, not merely into view. */
  const justOpened = useRef(false);
  const id = useId();

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value)
  );
  const selected = options[selectedIndex];

  // Clicking anywhere else closes it, which is what every dropdown does and
  // what people will try before looking for a close button.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Measured before paint, so the list never flashes in the wrong place first:
  // upwards when the button sits too low for it to open below, and no taller
  // than the room on the side it opens to.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const box = buttonRef.current.getBoundingClientRect();
    const height = Math.min(listRef.current?.scrollHeight ?? LIST_MAX, LIST_MAX);
    const below = window.innerHeight - box.bottom;
    const up = below < height + EDGE && box.top > below;
    setDropUp(up);
    setMaxHeight(Math.max(LIST_MIN, Math.min(LIST_MAX, (up ? box.top : below) - EDGE)));
  }, [open]);

  // The highlighted row stays in view as it moves -- scrolling the list only.
  // scrollIntoView would move the page as well. On opening, the chosen row is
  // brought to the middle, so what is picked now is what the reader sees.
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(`[data-index="${active}"]`);
    if (!list || !row) return;
    if (justOpened.current) {
      justOpened.current = false;
      list.scrollTop = row.offsetTop - (list.clientHeight - row.offsetHeight) / 2;
      return;
    }
    if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight) {
      list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight;
    }
  }, [open, active, maxHeight]);

  const openMenu = () => {
    setActive(selectedIndex);
    justOpened.current = true;
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openMenu();
      }
      return;
    }
    switch (e.key) {
      case "Escape":
        e.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
        break;
      case "ArrowDown":
        e.preventDefault();
        setActive((i) => Math.min(i + 1, options.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        e.preventDefault();
        setActive(0);
        break;
      case "End":
        e.preventDefault();
        setActive(options.length - 1);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        choose(active);
        break;
      default:
        break;
    }
  };

  return (
    <div ref={wrapRef}>
      <div className="flex items-baseline justify-between gap-3 mb-[7px]">
        <span className="t-micro" id={`${id}-label`}>
          {label}
        </span>
        {hint && <span className="t-small text-[var(--color-ink-3)]">{hint}</span>}
      </div>

      {/* The list is placed against the button, not the label above it. */}
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${id}-list`}
          aria-labelledby={`${id}-label`}
          onClick={() => (open ? setOpen(false) : openMenu())}
          onKeyDown={onKeyDown}
          className="w-full min-h-[44px] px-[14px] py-[8px] rounded-[var(--radius-sm)] border border-[var(--color-line-2)] bg-[var(--color-surface)] cursor-pointer flex items-center gap-3 text-left"
        >
          {/* min-w-0 lets the summary shrink and ellipsis rather than push the
            chevron off the edge. Closed, one line is right: the full reason is
            a tap away and the row must stay the height of a form control. */}
          <span className="min-w-0 flex-1 flex flex-col">
            <span className="t-body truncate">{selected?.label ?? "Choose"}</span>
            {selected?.detail && selected.detail.length > 0 && (
              <Detail bits={selected.detail} warn={selected.warn} clamp />
            )}
          </span>
          <span aria-hidden="true" className="t-small text-[var(--color-ink-3)] flex-none">
            {open ? "▴" : "▾"}
          </span>
        </button>

        {open && (
          <ul
            ref={listRef}
            id={`${id}-list`}
            role="listbox"
            aria-labelledby={`${id}-label`}
            tabIndex={-1}
            className={`absolute z-30 left-0 right-0 ${dropUp ? "bottom-full mb-1" : "top-full mt-1"} overflow-y-auto list-none p-0 m-0 rounded-[var(--radius-md)] border border-[var(--color-line-2)] bg-[var(--color-surface)] shadow-[var(--shadow-pop)]`}
            style={{ maxHeight }}
          >
            {options.map((o, i) => {
              const isSelected = o.value === value;
              const isActive = i === active;
              return (
                <li
                  key={o.value}
                  data-index={i}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(i)}
                  className="px-[14px] py-[10px] cursor-pointer border-b border-[var(--color-line)] last:border-b-0 flex flex-col gap-[2px]"
                  style={{
                    background: isActive
                      ? "var(--color-primary-soft)"
                      : isSelected
                        ? "var(--color-surface-2)"
                        : "var(--color-surface)",
                  }}
                >
                  <span className="t-body" style={{ fontWeight: isSelected ? 600 : 500 }}>
                    {o.label}
                  </span>
                  {o.detail && o.detail.length > 0 && <Detail bits={o.detail} warn={o.warn} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
