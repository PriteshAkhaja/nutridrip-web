"use client";

import { useLoginState, type DemoAccount } from "./LoginState";

/** The seeded accounts, each row a button that fills the sign-in form. */
export function DemoAccounts({ accounts }: { accounts: readonly DemoAccount[] }) {
  const { applyDemo, picked } = useLoginState();

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] overflow-hidden">
      {accounts.map(([role, email, password], i) => (
        <button
          key={email}
          type="button"
          onClick={() => {
            applyDemo(email, password);
            // Stacked under the form, a pick fills a form that is scrolled out
            // of sight, and the Sign in button with it. Beside it, it is on
            // screen already and scrolling would only jolt the page.
            if (window.matchMedia("(max-width: 1023px)").matches) {
              const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
              requestAnimationFrame(() =>
                document.getElementById("sign-in")?.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" }),
              );
            }
          }}
          aria-label={`Fill the form with the ${role} account`}
          className={`w-full text-left grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[110px_minmax(0,1fr)_auto] gap-x-3 gap-y-[2px] sm:gap-3 items-baseline px-4 py-3 cursor-pointer transition-colors duration-150 hover:bg-[var(--color-surface-2)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-primary)] ${
            picked === email ? "bg-[var(--color-surface-2)]" : "bg-transparent"
          } ${i === 0 ? "" : "border-t border-[var(--color-line)]"}`}
        >
          <span className="t-micro col-span-2 sm:col-span-1">{role}</span>
          <span className="t-data text-[13px] text-[var(--color-ink)] truncate">{email}</span>
          <span className="t-data text-[13px] text-[var(--color-ink-3)]">{password}</span>
        </button>
      ))}
    </div>
  );
}
