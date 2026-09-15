import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "./Logo";
import { SignOutButton } from "./SignOutButton";
import { NotificationBell } from "./NotificationBell";
import type { SessionPayload } from "@/lib/auth/session";

export type NavItem = {
  label: string;
  href: string;
  /** A count, not a decoration — omit it when there is nothing to count. */
  badge?: number | string;
  badgeTone?: "default" | "critical" | "caution";
};

/**
 * The 236px rail plus breadcrumbed header used by every desk-bound role.
 * Nav rows are 44px so the same shell works on a clinic tablet.
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
  const hasExact = nav.some((n) => n.href === activeHref);
  return (
    <div className="min-h-screen grid lg:grid-cols-[236px_1fr] bg-[var(--color-paper)]">
      {/* ---------------- Rail ---------------- */}
      <aside className="border-b lg:border-b-0 lg:border-r border-[var(--color-line)] px-[14px] py-[18px] flex flex-col gap-[22px] lg:sticky lg:top-0 lg:h-screen">
        <Link href="/" className="flex gap-[10px] items-center px-[6px] no-underline hover:no-underline">
          <LogoMark size={22} />
          <span style={{ font: "600 14.5px/1 var(--font-display)" }} className="text-[var(--color-ink)]">
            NutriDrip
          </span>
        </Link>

        <nav className="flex flex-col gap-[2px]" aria-label={roleLabel}>
          <span className="t-micro px-[6px] pb-[6px]">{roleLabel}</span>
          {nav.map((n) => {
            // Exact match wins. Only when no item matches exactly does a prefix
            // count, so /admin/inventory/orders does not also light "Products".
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
                className="flex items-center gap-[10px] min-h-[44px] px-[10px] rounded-[var(--radius-sm)] no-underline hover:no-underline transition-colors duration-150"
                style={{
                  background: active ? "var(--color-primary-soft)" : "transparent",
                  color: active ? "var(--color-primary-dark)" : "var(--color-ink-2)",
                  font: `${active ? 600 : 500} 14.5px/1.55 var(--font-sans)`,
                }}
              >
                <span
                  className="w-[6px] h-[6px] rounded-[2px] flex-none"
                  style={{ background: active ? "var(--color-primary)" : "var(--color-line-2)" }}
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
        </nav>

        <div className="mt-auto border-t border-[var(--color-line)] pt-[14px] px-[10px] flex flex-col gap-[5px]">
          <span className="t-body font-medium">{session.name}</span>
          <span className="t-data text-[13px] text-[var(--color-ink-3)]">{roleLabel}</span>
          <div className="mt-2">
            <SignOutButton />
          </div>
        </div>
      </aside>

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
            <NotificationBell />
          </div>
        </header>

        <div className="flex-1 px-6 lg:px-7 py-6">{children}</div>
      </div>
    </div>
  );
}
