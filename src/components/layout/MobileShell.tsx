import Link from "next/link";
import type { ReactNode } from "react";
import { LogoMark } from "./Logo";
import { NotificationBell } from "./NotificationBell";
import { Arrow } from "@/components/ui/Arrow";

export type Tab = { label: string; href: string; badge?: number };

/**
 * The 390 × 844 frame the patient and nurse apps are designed against. On a
 * larger screen the column simply centres rather than stretching, so the
 * layout the nurse rehearsed on a phone is the layout on a clinic tablet.
 */
export function MobileShell({
  title,
  subtitle,
  back,
  tabs,
  activeHref,
  action,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  tabs?: Tab[];
  activeHref?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[var(--color-paper)] flex flex-col">
      <header className="sticky top-0 z-30 bg-[var(--color-paper)] border-b border-[var(--color-line)]">
        <div className="mx-auto w-full max-w-[560px] px-5 py-3 flex items-center gap-3">
          {back ? (
            <Link
              href={back.href}
              aria-label={back.label}
              className="w-11 h-11 -ml-2 inline-flex items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-ink-2)] no-underline hover:no-underline hover:bg-[var(--color-surface-2)]"
            >
              <Arrow dir="left" />
            </Link>
          ) : (
            <LogoMark size={22} />
          )}
          <div className="min-w-0 flex-1">
            <h1 style={{ font: "600 18px/1.3 var(--font-display)", letterSpacing: "-0.02em" }} className="truncate">
              {title}
            </h1>
            {subtitle && <div className="t-small text-[var(--color-ink-3)] truncate">{subtitle}</div>}
          </div>
          {action ?? <NotificationBell />}
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-[560px] px-5 py-5 pb-28">{children}</main>

      {tabs && (
        <nav
          className="fixed bottom-0 inset-x-0 z-30 bg-[var(--color-surface)] border-t border-[var(--color-line)]"
          aria-label="Sections"
        >
          <div className="mx-auto w-full max-w-[560px] grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
            {tabs.map((t) => {
              const active = activeHref === t.href;
              return (
                <Link
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
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
