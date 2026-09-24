"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/**
 * A list that can be put in order by dragging, or from the keyboard.
 *
 * Built on pointer events, so one implementation serves a mouse, a finger and a
 * pen -- the HTML drag-and-drop API does not fire on touch screens at all, and a
 * reorder that only works at a desk is half a feature.
 *
 * The row being dragged follows the pointer and casts a shadow (it is a floating
 * layer, the one thing in the design system that may); the others slide aside
 * to show where it will land. Nothing is written until it is let go, and Escape
 * puts it back.
 *
 * From the keyboard: Tab to a row's handle, then the up and down arrows move it
 * one place at a time, and every move is announced to a screen reader.
 *
 * The handlers find the rows through the page (data attributes) rather than
 * through refs: they are handed to the row's own render function, and a
 * function that reads a ref must never be one that could run while rendering.
 */

export type HandleProps = {
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void;
  "data-sortable-handle": string;
  "aria-label": string;
  "aria-describedby": string;
  style: React.CSSProperties;
};

type Drag = {
  id: string;
  from: number;
  over: number;
  /** Where the pointer started, in page coordinates -- so scrolling mid-drag is counted. */
  startY: number;
  /** Where the pointer is now, in window coordinates. */
  clientY: number;
  dy: number;
  tops: number[];
  heights: number[];
  gap: number;
};

/** Where a row sits while another is being dragged: nudged aside, or in place. */
function shiftFor(i: number, d: Drag): number {
  const size = d.heights[d.from] + d.gap;
  if (d.from < d.over && i > d.from && i <= d.over) return -size;
  if (d.from > d.over && i >= d.over && i < d.from) return size;
  return 0;
}

/** Which slot the dragged row's middle is over. */
export function slotFor(d: Pick<Drag, "from" | "dy" | "tops" | "heights">): number {
  const middle = d.tops[d.from] + d.heights[d.from] / 2 + d.dy;
  let over = d.from;
  for (let i = d.from + 1; i < d.tops.length; i++) if (middle > d.tops[i] + d.heights[i] / 2) over = i;
  for (let i = d.from - 1; i >= 0; i--) if (middle < d.tops[i] + d.heights[i] / 2) over = i;
  return over;
}

export function move<T>(list: T[], from: number, to: number): T[] {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/** How near the top or bottom of the window a drag starts scrolling it. */
const EDGE = 72;

export function Sortable<T>({
  items,
  idOf,
  nameOf,
  onReorder,
  children,
  gapClass = "gap-3",
  disabled = false,
}: {
  items: T[];
  idOf: (item: T) => string;
  /** How a row is announced: "Moved “…” to position 3 of 5". */
  nameOf: (item: T) => string;
  onReorder: (next: T[], moved: { id: string; from: number; to: number; keyboard: boolean }) => void;
  children: (item: T, handle: HandleProps, state: { dragging: boolean; lifted: boolean }) => ReactNode;
  gapClass?: string;
  disabled?: boolean;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [announce, setAnnounce] = useState("");
  // A keyboard move re-draws the row somewhere else; focus must follow it there.
  const [focusRequest, setFocusRequest] = useState<{ id: string } | null>(null);
  // useId, not a random number: the server and the browser must draw the same id.
  const hintId = useId();
  const active = drag !== null;

  useEffect(() => {
    if (!focusRequest) return;
    listRef.current
      ?.querySelector<HTMLElement>(`[data-sortable-handle="${CSS.escape(focusRequest.id)}"]`)
      ?.focus();
  }, [focusRequest]);

  // The whole life of a drag, from the moment it starts: follow the pointer,
  // scroll near the window's edges, and drop -- or put back -- on release.
  useEffect(() => {
    if (!active || !drag) return;
    let current: Drag = drag;
    let frame = 0;

    const place = (clientY: number) => {
      const dy = clientY + window.scrollY - current.startY;
      current = { ...current, clientY, dy, over: slotFor({ ...current, dy }) };
      setDrag(current);
    };
    const finish = (commit: boolean) => {
      setDrag(null);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      if (!commit || current.over === current.from) return;
      setAnnounce(`Moved ${nameOf(items[current.from])} to position ${current.over + 1} of ${items.length}.`);
      onReorder(move(items, current.from, current.over), {
        id: current.id,
        from: current.from,
        to: current.over,
        keyboard: false,
      });
    };

    const onMove = (e: PointerEvent) => place(e.clientY);
    const tick = () => {
      const y = current.clientY;
      const speed =
        y < EDGE
          ? -Math.ceil((EDGE - y) / 6)
          : y > window.innerHeight - EDGE
            ? Math.ceil((y - (window.innerHeight - EDGE)) / 6)
            : 0;
      if (speed !== 0) {
        window.scrollBy(0, speed);
        place(current.clientY);
      }
      frame = requestAnimationFrame(tick);
    };
    const onUp = () => finish(true);
    const onCancel = () => finish(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish(false);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    frame = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
      cancelAnimationFrame(frame);
    };
    // Subscribed once per drag: the drag's live position is held in `current`,
    // not re-read from state on every move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const start = (id: string, index: number) => (e: React.PointerEvent<HTMLElement>) => {
    if (disabled || e.button !== 0) return;
    const list = e.currentTarget.closest<HTMLElement>("[data-sortable-list]");
    const rowEls = list ? (Array.from(list.children) as HTMLElement[]) : [];
    if (rowEls.length !== items.length) return;
    e.preventDefault();
    const rects = rowEls.map((el) => el.getBoundingClientRect());
    const tops = rects.map((r) => r.top + window.scrollY);
    const heights = rects.map((r) => r.height);
    const gap = tops.length > 1 ? tops[1] - (tops[0] + heights[0]) : 0;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";
    setDrag({
      id,
      from: index,
      over: index,
      startY: e.clientY + window.scrollY,
      clientY: e.clientY,
      dy: 0,
      tops,
      heights,
      gap,
    });
  };

  const keyMove = (id: string, index: number) => (e: React.KeyboardEvent<HTMLElement>) => {
    if (disabled) return;
    const to = e.key === "ArrowUp" ? index - 1 : e.key === "ArrowDown" ? index + 1 : null;
    if (to === null) return;
    e.preventDefault();
    if (to < 0 || to >= items.length) {
      setAnnounce(`${nameOf(items[index])} is already ${to < 0 ? "first" : "last"}.`);
      return;
    }
    setFocusRequest({ id });
    setAnnounce(`Moved ${nameOf(items[index])} to position ${to + 1} of ${items.length}.`);
    onReorder(move(items, index, to), { id, from: index, to, keyboard: true });
  };

  return (
    <>
      <div ref={listRef} data-sortable-list className={`flex flex-col ${gapClass}`}>
        {items.map((item, i) => {
          const id = idOf(item);
          const lifted = drag?.id === id;
          const shift = drag && !lifted ? shiftFor(i, drag) : 0;
          return (
            <div
              key={id}
              className="relative"
              style={{
                transform: lifted ? `translateY(${drag.dy}px)` : shift ? `translateY(${shift}px)` : undefined,
                transition: lifted ? "none" : "transform 150ms ease-out",
                zIndex: lifted ? 20 : undefined,
              }}
            >
              {children(
                item,
                {
                  onPointerDown: start(id, i),
                  onKeyDown: keyMove(id, i),
                  "data-sortable-handle": id,
                  "aria-label": `Reorder ${nameOf(item)} (position ${i + 1} of ${items.length})`,
                  "aria-describedby": hintId,
                  // Without this a finger on the handle scrolls the page instead of dragging.
                  style: { touchAction: "none", cursor: disabled ? "not-allowed" : lifted ? "grabbing" : "grab" },
                },
                { dragging: active, lifted }
              )}
            </div>
          );
        })}
      </div>
      <span id={hintId} className="sr-only">
        Drag to reorder, or use the up and down arrow keys.
      </span>
      <span aria-live="polite" className="sr-only">
        {announce}
      </span>
    </>
  );
}

/** Six dots, the mark people already read as "this can be picked up and moved". */
export function GripIcon() {
  return (
    <svg width="14" height="20" viewBox="0 0 14 20" aria-hidden fill="currentColor">
      {[4, 10, 16].map((y) => (
        <g key={y}>
          <circle cx="4" cy={y} r="1.6" />
          <circle cx="10" cy={y} r="1.6" />
        </g>
      ))}
    </svg>
  );
}
