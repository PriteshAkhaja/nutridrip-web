"use client";

import { useState, useSyncExternalStore } from "react";
import { RateSession } from "./sessions/SessionActions";
import type { SessionToRate } from "@/lib/data/feedback-prompt";

const later = (bookingId: string) => `nd_feedback_later:${bookingId}`;
const PUT_AWAY = "nd-feedback-later";

/** "Not now" is remembered on this device; this listens for it being set. */
function subscribe(changed: () => void) {
  window.addEventListener("storage", changed);
  window.addEventListener(PUT_AWAY, changed);
  return () => {
    window.removeEventListener("storage", changed);
    window.removeEventListener(PUT_AWAY, changed);
  };
}

/**
 * "How was your session with Emma?" -- asked on Home once a session is
 * finished, while it is fresh. "Not now" puts it away on this device for good;
 * the same form stays on the session report, so nothing is lost by it.
 */
export function FeedbackPrompt({ session }: { session: SessionToRate }) {
  // Whether it was put away on this device. Unknown on the server ("pending"),
  // so the card appears once the browser has said -- never flashing and going.
  const away = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(later(session.bookingId)) ?? "no";
      } catch {
        return "no"; // storage unavailable: ask, as if never put away
      }
    },
    () => "pending"
  );
  const [hidden, setHidden] = useState(false);
  const [sent, setSent] = useState(false);

  if (away !== "no" || hidden) return null;

  const first = session.nurseName?.split(" ")[0] ?? null;
  const notNow = () => {
    try {
      localStorage.setItem(later(session.bookingId), "1");
      window.dispatchEvent(new Event(PUT_AWAY));
    } catch {
      // Nothing to remember it in: it simply goes for now.
    }
    setHidden(true);
  };

  return (
    <section
      aria-label="Feedback on your session"
      className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 mb-4 flex flex-col gap-4"
    >
      <div>
        <span className="t-micro block">Your session is done</span>
        <h2 className="t-h3 mt-1">How was it{first ? ` with ${first}` : ""}?</h2>
        <span className="t-small text-[var(--color-ink-2)] block mt-1">
          {session.dripName ?? "Your drip"} ·{" "}
          <span className="t-data text-[12.5px]">{session.bookingNo}</span> ·{" "}
          {new Date(session.completedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
        </span>
      </div>

      <RateSession
        bookingId={session.bookingId}
        nurseName={session.nurseName}
        existing={null}
        bare
        refresh={false}
        onDone={() => setSent(true)}
      />

      {!sent && (
        <button
          type="button"
          onClick={notNow}
          className="self-center min-h-[40px] px-3 t-small text-[var(--color-ink-2)] underline-offset-2 hover:underline cursor-pointer"
        >
          Not now
        </button>
      )}
    </section>
  );
}
