"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type NavLink = { label: string; href: string };

/**
 * The header's nav, for screens too narrow to show it inline. Closes itself
 * on navigation, so a tap on a link never leaves the menu hanging open.
 */
export function MobileNav({
  links,
  account,
}: {
  links: NavLink[];
  account: { label: string; href: string };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  // Adjusting state during render on a prop/path change is the React-sanctioned
  // alternative to an effect here.
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="site-mobile-nav"
        aria-label={open ? "Close menu" : "Open menu"}
        className="w-11 h-11 inline-flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-line-2)] bg-[var(--color-surface)] cursor-pointer"
      >
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
          {open ? (
            <path d="M4 4l12 12M16 4L4 16" stroke="var(--color-ink)" strokeWidth="1.8" strokeLinecap="round" />
          ) : (
            <path d="M3 5h14M3 10h14M3 15h14" stroke="var(--color-ink)" strokeWidth="1.8" strokeLinecap="round" />
          )}
        </svg>
      </button>

      {open && (
        <div
          id="site-mobile-nav"
          className="absolute left-0 right-0 top-full border-b border-[var(--color-line)] bg-[var(--color-paper)]"
          style={{ boxShadow: "var(--shadow-pop)" }}
        >
          <nav className="mx-auto max-w-[1280px] px-6 py-3 flex flex-col" aria-label="Main">
            {links.map((l) => {
              const active = pathname === l.href || pathname.startsWith(l.href + "/");
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  aria-current={active ? "page" : undefined}
                  className="min-h-[48px] flex items-center no-underline hover:no-underline border-b border-[var(--color-line)] last:border-b-0"
                  style={{
                    font: `${active ? 600 : 500} 16px/1.4 var(--font-sans)`,
                    color: active ? "var(--color-primary)" : "var(--color-ink)",
                  }}
                >
                  {l.label}
                </Link>
              );
            })}
            <Link
              href={account.href}
              className="min-h-[48px] flex items-center no-underline hover:no-underline text-[var(--color-ink-2)]"
              style={{ font: "500 16px/1.4 var(--font-sans)" }}
            >
              {account.label}
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}
