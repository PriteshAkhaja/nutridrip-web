import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "./SignOutButton";
import { NotificationBell } from "./NotificationBell";
import { ConsoleRail } from "./ConsoleRail";
import type { SessionPayload } from "@/lib/auth/session";
import { can, type Permission } from "@/lib/auth/rbac";

/** "Dr. Sarah Menon" gives "SM": an honorific is a title, not part of the name. */
function initialsOf(name: string) {
  const words = name.trim().split(" ").filter((w) => w && !w.endsWith("."));
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return picked.map((w) => w.charAt(0).toUpperCase()).join("") || "?";
}

export type NavItem = {
  label: string;
  href: string;
  /**
   * The area it belongs to: the same word its pages’ breadcrumbs start
   * with, so the nav and the breadcrumb never name one place two ways.
   * Consecutive items sharing a section are drawn under one label.
   */
  section?: string;
  /** A count, not a decoration — omit it when there is nothing to count. */
  badge?: number | string;
  badgeTone?: "default" | "critical" | "caution";
  /**
   * The capability the destination needs. An item whose permission the signed-in
   * role lacks is left out of the rail entirely, rather than drawn and then
   * refused on click — a refusal from the guard is written to the audit trail,
   * and following a link that was offered is not an attempt at anything.
   */
  permission?: Permission;
};

/** Consecutive items with the same section, in nav order. */
function groupBySection(nav: NavItem[]) {
  const groups: Array<{ section?: string; items: NavItem[] }> = [];
  for (const item of nav) {
    const last = groups[groups.length - 1];
    if (last && last.section === item.section) last.items.push(item);
    else groups.push({ section: item.section, items: [item] });
  }
  return groups;
}

/**
 * The 240px rail plus breadcrumbed header used by every desk-bound role.
 * Nav rows are 44px so the same shell works on a clinic tablet; below `lg` the
 * rail folds into a drawer rather than stacking above the page.
 */
export function ConsoleShell({
  session,
  roleLabel,
  nav,
  activeHref,
  breadcrumb,
  title,
  meta,
  actions,
  children,
}: {
  session: SessionPayload;
  roleLabel: string;
  nav: NavItem[];
  activeHref: string;
  breadcrumb: string[];
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  // Only what this role could actually open.
  const visible = nav.filter((n) => !n.permission || can(session.role, n.permission));
  const hasExact = visible.some((n) => n.href === activeHref);
  return (
    <div className="min-h-dvh grid lg:grid-cols-[240px_1fr] bg-[var(--color-paper)]">
      {/* ---------------- Rail ----------------
          A column at lg, a drawer below it — see ConsoleRail. */}
      {/* Below lg the bell belongs in the sticky bar, where the app's chrome
          is, not in a page header that scrolls away with the content. The two
          copies are split by the same 64rem line as the lg: classes that
          hide them, and each only polls while it is the one shown. */}
      <ConsoleRail actions={<NotificationBell media="not all and (min-width: 64rem)" />}>
        {/* Only the list scrolls: the header above and the account below hold
            their place, and the nav takes whatever height is left, so Sign out
            never falls below the fold on a short screen. */}
        <nav
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain [scrollbar-width:thin] [scrollbar-color:var(--color-line-2)_transparent] px-[14px] pt-4 lg:pt-2 pb-3 flex flex-col"
          aria-label={roleLabel}
        >
          {groupBySection(visible).map((group, gi) => {
            const labelId = group.section ? `nav-${group.section.toLowerCase().replace(/[^a-z]+/g, "-")}` : undefined;
            return (
              <div
                key={group.section ?? gi}
                role={group.section ? "group" : undefined}
                aria-labelledby={labelId}
                className={`flex flex-col gap-[2px] ${gi > 0 ? "mt-5" : ""}`}
              >
                {group.section && (
                  <span id={labelId} className="t-micro px-[6px] pb-[6px]">
                    {group.section}
                  </span>
                )}
                {group.items.map((n) => {
                  // Exact match wins. Only when no item matches exactly does a
                  // prefix count, so /admin/inventory/orders does not also
                  // light "Products".
                  const active = hasExact
                    ? activeHref === n.href
                    : n.href !== "/" && activeHref.startsWith(n.href + "/");
                  const badgeColor =
                    n.badgeTone === "critical"
                      ? "var(--color-critical)"
                      : n.badgeTone === "caution"
                        ? "var(--color-caution)"
                        : active
                          ? "var(--color-primary-dark)"
                          : "var(--color-ink-3)";
                  return (
                    <Link
                      key={n.href}
                      href={n.href}
                      aria-current={active ? "page" : undefined}
                      // Classes rather than inline styles, so a hover can
                      // actually change them. There was no hover or focus
                      // state before: nothing said a row was reachable until
                      // it had been clicked.
                      className={`group flex items-center gap-[10px] min-h-[44px] px-[10px] rounded-[var(--radius-sm)] text-[14.5px] leading-[1.55] no-underline hover:no-underline transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-primary)] ${
                        active
                          ? "bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)] font-semibold"
                          : "text-[var(--color-ink-2)] font-medium hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
                      }`}
                    >
                      <span
                        className={`w-[6px] h-[6px] rounded-[2px] flex-none transition-colors duration-150 ${
                          active ? "bg-[var(--color-primary)]" : "bg-[var(--color-line-2)] group-hover:bg-[var(--color-ink-3)]"
                        }`}
                      />
                      <span className="truncate">{n.label}</span>
                      {n.badge !== undefined && n.badge !== "" && (
                        <span className="ml-auto t-data text-[13px] leading-none" style={{ color: badgeColor }}>
                          {n.badge}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* One row: who is signed in, and the way out. It sits pinned under
            a scrolling list, so every pixel it takes is a pixel of nav lost on
            a short screen — the button is an icon for that reason, and the row
            is no taller than its 44px target. It wraps only to show a warning
            or a failed sign-out underneath. The role is a label, not a figure,
            so it is in the prose face; mono is kept for doses and dates. */}
        <div className="shrink-0 border-t border-[var(--color-line)] pt-3 pb-3 pl-5 pr-[14px] flex flex-wrap items-center gap-x-[10px] gap-y-2">
          <span
            aria-hidden
            className="w-8 h-8 rounded-full flex-none inline-flex items-center justify-center bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)] text-[12px] font-semibold tracking-[0.02em]"
          >
            {initialsOf(session.name)}
          </span>
          <span className="flex-1 min-w-0 flex flex-col leading-tight">
            <span className="text-[14px] font-medium text-[var(--color-ink)] truncate">{session.name}</span>
            <span className="text-[12.5px] text-[var(--color-ink-3)] truncate">{roleLabel}</span>
          </span>
          <SignOutButton form="icon" />
        </div>
      </ConsoleRail>

      {/* ---------------- Main ---------------- */}
      <div className="min-w-0 flex flex-col">
        <header className="flex items-center gap-4 px-6 lg:px-7 py-4 border-b border-[var(--color-line)] bg-[var(--color-surface)] flex-wrap">
          <div className="min-w-0">
            <div className="flex gap-[7px] items-center t-small text-[var(--color-ink-3)]">
              {breadcrumb.map((b, i) => (
                <span key={b} className={i === breadcrumb.length - 1 ? "text-[var(--color-ink)]" : ""}>
                  {i > 0 && <span className="mr-[7px]">/</span>}
                  {b}
                </span>
              ))}
            </div>
            <h1 className="t-h3 mt-[2px]">{title}</h1>
          </div>
          {/* min-w-0 so a long summary can shrink and wrap rather than push
              the bell off the edge; ml-auto keeps it right on a wide screen. */}
          <div className="ml-auto min-w-0 flex gap-3 items-center flex-wrap justify-end">
            {meta && <span className="t-data text-[13px] text-[var(--color-ink-3)] min-w-0">{meta}</span>}
            {actions}
            <div className="hidden lg:block">
              <NotificationBell media="(min-width: 64rem)" />
            </div>
          </div>
        </header>

        <div className="flex-1 px-6 lg:px-7 py-6">{children}</div>
      </div>
    </div>
  );
}
