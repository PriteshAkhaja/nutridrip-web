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
          onClick={() => applyDemo(email, password)}
          aria-label={`Fill the form with the ${role} account`}
          className={`w-full text-left grid grid-cols-[110px_1fr_auto] gap-3 items-baseline px-4 py-3 cursor-pointer transition-colors duration-150 hover:bg-[var(--color-surface-2)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-primary)] ${
            picked === email ? "bg-[var(--color-surface-2)]" : "bg-transparent"
          } ${i === 0 ? "" : "border-t border-[var(--color-line)]"}`}
        >
          <span className="t-micro">{role}</span>
          <span className="t-data text-[13px] text-[var(--color-ink)] truncate">{email}</span>
          <span className="t-data text-[13px] text-[var(--color-ink-3)]">{password}</span>
        </button>
      ))}
    </div>
  );
}
