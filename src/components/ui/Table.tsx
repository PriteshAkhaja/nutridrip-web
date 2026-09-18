import { Fragment, type ReactNode } from "react";

/**
 * Wide tables scroll inside their own container so the page body never scrolls
 * sideways. Numeric columns are right-aligned and monospaced — a misread dose
 * has to work harder to happen.
 *
 * The container is focusable on purpose: a region that scrolls but holds no
 * focusable children cannot be panned from the keyboard, so the columns past
 * the right edge would be unreachable without a mouse.
 */
export function DataTable({
  children,
  className = "",
  label,
}: {
  children: ReactNode;
  className?: string;
  /** What the table holds, announced to anyone who reaches it by keyboard. */
  label?: string;
}) {
  return (
    <div
      tabIndex={0}
      role="group"
      aria-label={label ?? "Scrollable table"}
      className={`scroll-x rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] ${className}`}
    >
      {/* The 640px floor keeps a table from being crushed on a phone or tablet,
          where it scrolls instead. From xl up, tables sit in side-by-side
          columns narrower than that, and a floor there made a three-column
          table scroll with half its box empty — so above xl the content alone
          decides, and names and dates are already held whole by `nowrap`. */}
      <table className="w-full border-collapse min-w-[640px] xl:min-w-0">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return <thead className="bg-[var(--color-surface-2)]">{children}</thead>;
}

export function TH({
  children,
  numeric = false,
  width,
}: {
  children: ReactNode;
  numeric?: boolean;
  width?: string;
}) {
  return (
    <th
      scope="col"
      style={{ width }}
      // 12px either side, as the Block 5 and 6 mockups draw their rows. The
      // build had drifted to 16px, which cost dense tables like Users and
      // Batches the last few columns on a laptop once names stopped wrapping.
      className={`t-micro px-3 py-[10px] border-b border-[var(--color-line)] ${
        numeric ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

export function TR({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <tr
      onClick={onClick}
      className={`border-b border-[var(--color-line)] last:border-b-0 ${
        onClick ? "cursor-pointer hover:bg-[var(--color-surface-2)] transition-colors duration-150" : ""
      }`}
    >
      {children}
    </tr>
  );
}

export function TD({
  children,
  numeric = false,
  mono = false,
  nowrap = false,
  className = "",
}: {
  children: ReactNode;
  numeric?: boolean;
  mono?: boolean;
  /**
   * Keep the cell on its own line(s) and let the column take the width of its
   * text. For anything read as one unit — a name, a reference, a date, a time,
   * a duration. Left to wrap, an auto-sized table squeezes these to their
   * longest word, so "Riya Mehta" stacked into two lines and a booking time
   * into six; the table scrolls sideways inside its own box instead. Leave it
   * off for free text, which should wrap.
   */
  nowrap?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`px-3 py-[14px] align-middle ${numeric ? "text-right" : "text-left"} ${
        mono || numeric ? "t-data text-[14.5px]" : "t-body"
      } ${nowrap ? "whitespace-nowrap" : ""} ${className}`}
    >
      {children}
    </td>
  );
}

/**
 * A list in a cell that may wrap, but only between whole items: "Myers'
 * Revive × 2," never parts from its count, and a registration number is never
 * split across two lines. The separator stays at the end of the line it
 * closes, so a wrapped list still reads as one.
 */
export function Pieces({ items, separator = ", " }: { items: ReactNode[]; separator?: string }) {
  const shown = items.filter((item) => item !== null && item !== undefined && item !== false && item !== "");
  const tail = separator.trimEnd();
  return (
    <>
      {shown.map((item, i) => (
        <Fragment key={i}>
          <span className="whitespace-nowrap">
            {item}
            {i < shown.length - 1 ? tail : null}
          </span>
          {i < shown.length - 1 ? " " : null}
        </Fragment>
      ))}
    </>
  );
}
