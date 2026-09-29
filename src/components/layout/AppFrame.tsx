"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoMark } from "./Logo";
import { NotificationBell } from "./NotificationBell";
import { BackLink } from "./NavTrail";
import { NavLink, PageReset } from "./PageReset";
import { SignOutButton } from "./SignOutButton";
import { SyncStatus } from "./SyncStatus";
import type { Tab } from "./MobileShell";
import { PATIENT_TABS } from "@/app/app/tabs";
import { NURSE_TABS } from "@/app/nurse/tabs";

/** "Dr. Sarah Menon" gives "SM": an honorific is a title, not part of the name. */
function initialsOf(name: string) {
  const words = name
    .trim()
    .split(" ")
    .filter((w) => w && !w.endsWith("."));
  const picked = words.length > 1 ? [words[0], words[words.length - 1]] : words;
  return picked.map((w) => w.charAt(0).toUpperCase()).join("") || "?";
}

/**
 * The patient and nurse apps at every width:
 *
 * - below 768px (phone): the app as it was designed, bottom tabs and all;
 * - 768–1023px (tablet, e.g. an iPad held upright): the same bottom tabs, and
 *   the page takes the full width instead of a phone column;
 * - 1024px and up (desktop): a 240px sidebar, as in the consoles, in place of
 *   the bottom tabs, and the page beside it.
 *
 * The tablet band starts at 768px (Tailwind's `md`), not the design proofs'
 * 834px: most iPads held upright are 744–820px wide.
 */
export function AppFrame({
  title,
  subtitle,
  back,
  tabs,
  activeHref,
  action,
  width,
  user,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  tabs?: Tab[];
  activeHref?: string;
  action?: ReactNode;
  width: "narrow" | "wide";
  user: { name: string; roleLabel: string } | null;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const nurse = pathname.startsWith("/nurse");
  const home = nurse ? "/nurse" : "/app";
  // The sidebar always offers the app's sections, even on a page (a session,
  // a report) that hides the bottom tabs to keep the phone screen for the task.
  const railTabs = tabs ?? (nurse ? NURSE_TABS : PATIENT_TABS);
  const current =
    activeHref ??
    (railTabs.some((t) => t.href === back?.href) ? back?.href : undefined) ??
    [...railTabs].sort((a, b) => b.href.length - a.href.length).find((t) => pathname.startsWith(t.href))?.href;

  // The nurse app is used standing, one-handed, often gloved: 56px rows.
  const row = nurse ? "min-h-[56px]" : "min-h-[44px]";
  // Phone: the 560px column it was designed in. Tablet: the whole width.
  // Desktop: a reading column beside the sidebar, or, for a page laid out in
  // columns of its own, all the width there is: a cap left a strip of empty
  // screen on the right of a big monitor.
  const column =
    width === "wide" ? "max-w-[560px] md:max-w-none lg:max-w-none" : "max-w-[560px] md:max-w-none lg:max-w-[680px]";

  return (
    <div className="min-h-dvh bg-[var(--color-paper)] lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside
        aria-label={nurse ? "Nurse app" : "Patient app"}
        className="hidden lg:flex flex-col sticky top-0 h-dvh border-r border-[var(--color-line)] bg-[var(--color-paper)]"
      >
        <div className="shrink-0 h-14 flex items-center pl-5 pr-3">
          <Link
            href={home}
            className="flex gap-[10px] items-center no-underline hover:no-underline rounded-[var(--radius-sm)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-primary)]"
          >
            <LogoMark size={22} />
            <span style={{ font: "600 14.5px/1 var(--font-display)" }} className="text-[var(--color-ink)]">
              NutriDrip
            </span>
          </Link>
        </div>

        <nav
          aria-label="Sections"
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-[14px] pt-2 pb-3 flex flex-col gap-[2px]"
        >
          {railTabs.map((t) => {
            const active = current === t.href;
            return (
              <NavLink
                key={t.href}
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`group flex items-center gap-[10px] ${row} px-[10px] rounded-[var(--radius-sm)] text-[14.5px] leading-[1.55] no-underline hover:no-underline transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-primary)] ${
                  active
                    ? "bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)] font-semibold"
                    : "text-[var(--color-ink-2)] font-medium hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
                }`}
              >
                <span
                  className={`w-[6px] h-[6px] rounded-[2px] flex-none transition-colors duration-150 ${
                    active
                      ? "bg-[var(--color-primary)]"
                      : "bg-[var(--color-line-2)] group-hover:bg-[var(--color-ink-3)]"
                  }`}
                />
                <span className="truncate">{t.label}</span>
                {t.badge !== undefined && t.badge > 0 && (
                  <span className="ml-auto t-data text-[13px] leading-none text-[var(--color-ink-3)]">{t.badge}</span>
                )}
              </NavLink>
            );
          })}
        </nav>

        {user && (
          <div className="shrink-0 border-t border-[var(--color-line)] pt-3 pb-3 pl-5 pr-[14px] flex flex-wrap items-center gap-x-[10px] gap-y-2">
            <span
              aria-hidden
              className="w-8 h-8 rounded-full flex-none inline-flex items-center justify-center bg-[var(--color-primary-soft)] text-[var(--color-primary-dark)] text-[12px] font-semibold tracking-[0.02em]"
            >
              {initialsOf(user.name)}
            </span>
            <span className="flex-1 min-w-0 flex flex-col leading-tight">
              <span className="text-[14px] font-medium text-[var(--color-ink)] truncate">{user.name}</span>
              <span className="text-[12.5px] text-[var(--color-ink-3)] truncate">{user.roleLabel}</span>
            </span>
            <SignOutButton form="icon" />
          </div>
        )}
      </aside>

      <div className="min-w-0 flex flex-col min-h-dvh">
        <header className="sticky top-0 z-30 bg-[var(--color-paper)] border-b border-[var(--color-line)]">
          <div className="mx-auto w-full max-w-[560px] md:max-w-none px-5 md:px-8 py-3 flex items-center gap-3">
            {/* `back` is the page's usual parent; the arrow goes where the page
                was actually entered from when that is known (see NavTrail).
                Without one, the logo, which the sidebar carries on a desktop. */}
            {back ? (
              <BackLink fallback={back} />
            ) : (
              <span className="lg:hidden flex-none">
                <LogoMark size={22} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <h1
                style={{ letterSpacing: "-0.02em" }}
                className="truncate [font:600_18px/1.3_var(--font-display)] lg:[font:600_21px/1.3_var(--font-display)]"
              >
                {title}
              </h1>
              {subtitle && <div className="t-small text-[var(--color-ink-3)] truncate">{subtitle}</div>}
            </div>
            {action ?? <NotificationBell />}
          </div>
        </header>

        <main className={`@container flex-1 mx-auto lg:mx-0 w-full ${column} px-5 md:px-8 py-5 lg:py-7 pb-28 lg:pb-10`}>
          {/* The nurse app's outbox: what is waiting to sync, above the page. */}
          {nurse && <SyncStatus />}
          <PageReset>{children}</PageReset>
        </main>

        {/* Phone and tablet. On a desktop the sidebar takes their place. */}
        {tabs && (
          <nav
            className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-[var(--color-surface)] border-t border-[var(--color-line)]"
            aria-label="Sections"
          >
            <div
              className="mx-auto w-full max-w-[560px] md:max-w-none md:px-8 grid"
              style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}
            >
              {tabs.map((t) => {
                const active = activeHref === t.href;
                return (
                  <NavLink
                    key={t.href}
                    href={t.href}
                    aria-current={active ? "page" : undefined}
                    className="flex flex-col items-center gap-[6px] pt-[10px] pb-[14px] no-underline hover:no-underline"
                    style={{
                      borderTop: `2px solid ${active ? "var(--color-primary)" : "transparent"}`,
                      marginTop: -1,
                    }}
                  >
                    <span
                      className="w-[6px] h-[6px] rounded-full"
                      style={{ background: active ? "var(--color-primary)" : "var(--color-line-2)" }}
                    />
                    <span
                      className="t-micro"
                      style={{
                        color: active ? "var(--color-ink)" : "var(--color-ink-2)",
                        fontWeight: active ? 600 : 500,
                      }}
                    >
                      {t.label}
                    </span>
                    {t.badge !== undefined && t.badge > 0 && (
                      <span className="t-data text-[11px] text-[var(--color-ink-3)] leading-none">{t.badge}</span>
                    )}
                  </NavLink>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
