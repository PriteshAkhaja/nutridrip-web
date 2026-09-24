"use client";

import { useEffect, useState } from "react";
import type { LiveCode } from "@/lib/data/session-codes";

/** How often to look for a code while a session is on. */
const POLL_MS = 5_000;

/**
 * The code the patient's nurse is waiting on, large enough to read out.
 *
 * There is no SMS gateway, so this is how a code reaches the patient: the nurse
 * presses Send at the chair, and within a few seconds it is here. The card asks
 * again every few seconds while a session is on and the app is open -- not
 * otherwise -- and a code disappears once the nurse has used it or it expires.
 */
export function NurseCodes({
  initial,
  active,
  bookingNo,
}: {
  initial: LiveCode[];
  /** A session is on (approved and not finished), so a nurse may ask for a code. */
  active: boolean;
  /** Show only this session's codes (the session page); all of them on Home. */
  bookingNo?: string;
}) {
  const [codes, setCodes] = useState(initial);
  // The clock, read after mount only, so the first paint matches the server.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!active) return;
    let stopped = false;
    const look = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/me/session-codes", { cache: "no-store" });
        const json = (await res.json()) as { success: boolean; data?: { codes: LiveCode[] } };
        if (!stopped && json.success) setCodes(json.data?.codes ?? []);
      } catch {
        // Offline for a moment: keep what is on screen and try again.
      }
    };
    const timer = setInterval(look, POLL_MS);
    const onShow = () => void look();
    document.addEventListener("visibilitychange", onShow);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [active]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const timer = setInterval(tick, 15_000);
    return () => clearInterval(timer);
  }, []);

  const shown = codes
    .filter((c) => !bookingNo || c.bookingNo === bookingNo)
    .filter((c) => now === null || new Date(c.expiresAt).getTime() > now);

  return (
    // Announced when a code arrives, so a patient using a screen reader hears it.
    <div aria-live="polite">
      {shown.length > 0 && (
        <div className="flex flex-col gap-3 mb-4">
          {shown.map((c) => {
            const minutes = now === null ? null : Math.max(1, Math.ceil((new Date(c.expiresAt).getTime() - now) / 60_000));
            return (
              <section
                key={c.id}
                aria-label="Code for your nurse"
                className="rounded-[var(--radius-lg)] border-[1.5px] border-[var(--color-primary)] bg-[var(--color-primary-soft)] p-5"
              >
                <span className="t-micro block text-[var(--color-primary-text)]">Your nurse is asking for a code</span>
                <p className="t-body mt-1">Read this to your nurse {c.forWhat}.</p>
                <p
                  className="mt-3 text-[var(--color-ink)] tabular-nums"
                  style={{ font: "600 36px/1.1 var(--font-mono)", letterSpacing: "0.16em" }}
                  aria-label={`Code: ${c.code.split("").join(" ")}`}
                >
                  {c.code.slice(0, 3)} {c.code.slice(3)}
                </p>
                <span className="t-small block mt-3 text-[var(--color-ink-2)]">
                  {minutes === null ? "Lasts ten minutes" : `Expires in ${minutes} min`}
                  {c.bookingNo ? <> · <span className="t-data text-[12.5px]">{c.bookingNo}</span></> : null}
                </span>
                <span className="t-small block mt-1 text-[var(--color-ink-2)]">
                  Only read it to the nurse who is with you. NutriDrip will never phone or message you to ask for it.
                </span>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
