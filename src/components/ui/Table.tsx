import type { ReactNode } from "react";

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
      <table className="w-full border-collapse min-w-[640px]">{children}</table>
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
      className={`t-micro px-4 py-[10px] border-b border-[var(--color-line)] ${
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
  className = "",
}: {
  children: ReactNode;
  numeric?: boolean;
  mono?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`px-4 py-[14px] align-middle ${numeric ? "text-right" : "text-left"} ${
        mono || numeric ? "t-data text-[14.5px]" : "t-body"
      } ${className}`}
    >
      {children}
    </td>
  );
}
