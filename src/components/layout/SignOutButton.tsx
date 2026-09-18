"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { getEmptyQueue, getQueue, subscribeQueue } from "@/lib/offline/queue";

/**
 * Signing out, in every shell.
 *
 * It is not styled as `destructive`: that variant proposes removing something,
 * and signing out removes nothing — it reads as a real action (`secondary`), or
 * as dismissal in a header (`ghost`). Every form is at least 44px tall, because
 * the console drawer and both phone apps put it under a thumb.
 *
 * Two failures it no longer hides:
 *
 * - **A request that fails.** The old button awaited the logout and never
 *   caught, so a dropped connection left it saying "Signing out…" for good, with
 *   the session still live. It now says so and can be tried again. A non-OK
 *   answer is treated the same: navigating to /login with the cookie still set
 *   would only bounce straight back to the dashboard.
 * - **Unsynced clinical writes.** The nurse app's outbox holds ticks, vitals
 *   and consents that have not reached the server yet. Signing out over them
 *   gets a plain warning first. The outbox itself is left exactly as it is —
 *   this asks, it does not decide what happens to the writes.
 */
/**
 * `block`   full width, under a list — the phone apps' profile pages
 * `compact` a header link, sized to its label
 * `icon`    a 44px square beside the signed-in person — the console rail,
 *           where a labelled button would squeeze the name down to a few
 *           letters. It keeps its name for screen readers and a tooltip.
 */
export type SignOutForm = "block" | "compact" | "icon";

export function SignOutButton({ form = "block" }: { form?: SignOutForm }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const id = useId();
  // Empty everywhere but a nurse's device with writes still waiting.
  const queue = useSyncExternalStore(subscribeQueue, getQueue, getEmptyQueue);

  const signOut = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/auth/logout", { method: "POST" });
      if (!res.ok) throw new Error(`logout ${res.status}`);
      // Replace, not push: Back should not land on a page from the session
      // that just ended.
      router.replace("/login");
      router.refresh();
    } catch {
      setBusy(false);
      setFailed(true);
    }
  };

  const start = () => {
    if (queue.length > 0) setConfirming(true);
    else void signOut();
  };

  if (confirming) {
    const n = queue.length;
    return (
      <div
        role="alertdialog"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-body`}
        className="w-full basis-full flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-caution)] bg-[var(--color-surface)] p-3"
      >
        <div className="flex flex-col gap-1">
          <span id={`${id}-title`} className="t-small font-semibold text-[var(--color-caution-text)]">
            {n === 1 ? "1 change hasn’t synced" : `${n} changes haven’t synced`}
          </span>
          <span id={`${id}-body`} className="t-small text-[var(--color-ink-2)]">
            {n === 1 ? "It has" : "They have"} not reached the server yet. If you sign out now,{" "}
            {n === 1 ? "it" : "they"} may not be saved.
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <Button variant="secondary" block autoFocus onClick={() => setConfirming(false)}>
            Stay signed in
          </Button>
          <Button
            variant="danger"
            block
            loading={busy}
            onClick={() => void signOut()}
          >
            {busy ? "Signing out…" : "Sign out anyway"}
          </Button>
        </div>
        {failed && <FailedNote />}
      </div>
    );
  }

  if (form === "icon") {
    const label = busy ? "Signing out…" : failed ? "Try signing out again" : "Sign out";
    return (
      <>
        <button
          type="button"
          onClick={start}
          disabled={busy}
          aria-label={label}
          title={label}
          aria-busy={busy || undefined}
          className="flex-none w-11 h-11 inline-flex items-center justify-center rounded-[var(--radius-sm)] border border-transparent text-[var(--color-ink-2)] cursor-pointer transition-colors duration-150 hover:bg-[var(--color-surface-2)] hover:border-[var(--color-line)] hover:text-[var(--color-ink)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-primary)] disabled:cursor-default disabled:hover:bg-transparent disabled:hover:border-transparent"
        >
          {busy ? (
            <span
              aria-hidden
              className="inline-block w-4 h-4 rounded-full animate-spin border-2 border-[var(--color-line)] border-t-[var(--color-primary)]"
            />
          ) : (
            <SignOutGlyph />
          )}
        </button>
        {failed && (
          <span className="w-full basis-full">
            <FailedNote />
          </span>
        )}
      </>
    );
  }

  const compact = form === "compact";
  return (
    <div className={compact ? "flex flex-col items-end gap-1" : "flex flex-col gap-2"}>
      <Button
        variant={compact ? "ghost" : "secondary"}
        block={!compact}
        loading={busy}
        onClick={start}
      >
        {!busy && <SignOutGlyph />}
        {busy ? "Signing out…" : failed ? "Try again" : "Sign out"}
      </Button>
      {failed && <FailedNote />}
    </div>
  );
}

function FailedNote() {
  return (
    <span role="alert" className="t-small text-[var(--color-critical-text)]">
      Couldn’t sign out. Check your connection and try again.
    </span>
  );
}

/** A door and an arrow leaving it — the conventional mark, drawn in currentColor. */
function SignOutGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden className="flex-none">
      <path d="M8 3.5H5A1.5 1.5 0 0 0 3.5 5v10A1.5 1.5 0 0 0 5 16.5h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12.5 6.5 16 10l-3.5 3.5M16 10H7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
