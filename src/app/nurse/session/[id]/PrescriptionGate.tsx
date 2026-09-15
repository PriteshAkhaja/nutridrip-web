"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { OtpBoxes } from "@/components/ui/OtpBoxes";
import { describeWait, RX_OVERRIDE_WAIT_MIN } from "@/lib/clinical/prescription";

/**
 * What has already happened on this session, as words rather than timestamps —
 * every date is formatted on the server, because this component server-renders
 * first and a date formatted on both sides lands in two different time zones.
 */
export type OverrideState = {
  asked: boolean;
  askedAt: string | null;
  /** Set only when the nurse has chased an unanswered request. */
  chasedAt: string | null;
  reason: string | null;
  /** The physician it went to, or null when it went to all of them. */
  askedWho: string | null;
  /** Their number, so a waiting nurse can ring rather than refresh. */
  askedPhone: string | null;
  /** The first ask, for a counter that keeps running while the page is open. */
  askedAtIso: string | null;
  /** "waiting 14 min", as it stood when the page was rendered. */
  waited: string | null;
  denied: boolean;
  deniedAt: string | null;
  deniedWho: string | null;
  denyReason: string | null;
};

/**
 * Ask the patient for their code, then type it in.
 *
 * The patient reads it from their own phone, which is the point: it proves the
 * nurse is in front of them before the drugs and doses are shown. It is not a
 * second sign-in — the nurse is already authenticated and already owns this
 * session; this is presence, not identity.
 *
 * Deliberately not queued through the offline outbox: there is nothing to
 * replay later, because the nurse needs the answer now to keep working.
 */
export function PrescriptionGate({
  bookingId,
  patientName,
  override,
}: {
  bookingId: string;
  patientName: string;
  /** Any physician request already outstanding on this session. */
  override?: OverrideState | null;
}) {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* The way out when the patient cannot give a code at all. Open from the
     start once something has been asked: a nurse who has already been down this
     road is in that situation, and making them find the link again to see their
     own outstanding request is how they end up asking twice. */
  const [stuckOpen, setStuckOpen] = useState(Boolean(override?.asked));
  // Seeded with what was already sent. Coming back to this screen and finding
  // the box empty reads as "nothing was asked", and invites typing it again.
  const [reason, setReason] = useState(override?.reason ?? "");
  const [identity, setIdentity] = useState("");
  const [confirmGlass, setConfirmGlass] = useState(false);

  /**
   * The waiting time keeps counting while this page sits open.
   *
   * Seeded from the server's own figure so the first paint matches what was
   * rendered — computing it on both sides would resolve in two clocks and tear
   * on hydration. The interval only ever writes after mount.
   */
  const [waited, setWaited] = useState(override?.waited ?? null);
  useEffect(() => {
    const iso = override?.askedAtIso;
    if (!iso) return;
    const timer = setInterval(() => setWaited(describeWait(iso)), 30_000);
    return () => clearInterval(timer);
  }, [override?.askedAtIso]);

  const overrideCall = async (body: Record<string, unknown>) => {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/bookings/${bookingId}/rx-override`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as { success: boolean; error?: string };
    setBusy(false);
    if (!json.success) return setError(json.error ?? "That did not go through");
    router.refresh();
  };

  const call = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/bookings/${bookingId}/rx-otp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json() as Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>;
  };

  const request = async () => {
    setBusy(true);
    setError(null);
    const json = await call({ mode: "request" });
    setBusy(false);
    if (!json.success) return setError(json.error ?? "Could not send the code");
    if (json.data?.alreadyUnlocked) return router.refresh();
    setSent(true);
    setSentTo((json.data?.sentTo as string) ?? null);
    setDevCode((json.data?.devCode as string) ?? null);
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    const json = await call({ mode: "verify", code });
    setBusy(false);
    if (!json.success) return setError(json.error ?? "That did not work");
    router.refresh();
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line-2)] bg-[var(--color-surface)] p-6 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="t-micro">Prescription locked</span>
        <h2 className="t-h3">Ask {patientName} for their code</h2>
        <p className="t-body text-[var(--color-ink-2)]">
          The drugs and doses are {patientName}&rsquo;s medical record. Sending a code to their phone, and having them
          read it to you, is how we record that you are actually with them before it opens.
        </p>
      </div>

      {!sent ? (
        <Button block loading={busy} onClick={request}>
          Send a code to the patient
        </Button>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="rounded-[var(--radius-md)] border border-[var(--color-info)] bg-[var(--color-info-soft)] px-4 py-3">
            <span className="t-body text-[var(--color-ink-2)]">
              Code sent{sentTo ? <> to <span className="t-data text-[13px]">{sentTo}</span></> : null}. It appears in
              their app and lasts ten minutes.
            </span>
            {devCode && (
              <div className="mt-2">
                <span className="t-small text-[var(--color-ink-3)]">
                  No SMS gateway in development, so the code is{" "}
                  <span className="t-data text-[13px] text-[var(--color-ink)]">{devCode}</span>
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-[7px]">
            <span className="t-micro">The six digits they read out</span>
            <OtpBoxes value={code} onChange={setCode} autoFocus />
          </div>

          <div className="flex gap-2">
            <Button variant="secondary" loading={busy} onClick={request}>
              Resend
            </Button>
            <Button block loading={busy} disabled={code.length !== 6} onClick={verify}>
              Open the prescription
            </Button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3">
          <span className="t-body text-[var(--color-ink-2)]">{error}</span>
        </div>
      )}

      {/* ---------------- when there can be no code ---------------- */}
      <div className="border-t border-[var(--color-line)] pt-4">
        {/* What has already been asked, and what came back. Always on screen,
            not hidden behind the disclosure below: a nurse who walks away and
            comes back needs to see the state of their request without having
            to go looking for it, or they will simply ask again. */}
        {override?.asked && (
          <div
            className="rounded-[var(--radius-md)] border px-4 py-3 mb-3 flex flex-col gap-2"
            style={{
              borderColor: override.denied ? "var(--color-critical)" : "var(--color-info)",
              background: override.denied ? "var(--color-critical-soft)" : "var(--color-info-soft)",
            }}
          >
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <span
                className="t-micro"
                style={{ color: override.denied ? "var(--color-critical-text)" : "var(--color-info-text)" }}
              >
                {override.denied ? "A physician refused this" : "Waiting on a physician"}
              </span>
              {!override.denied && waited && (
                <span className="t-data text-[13px] text-[var(--color-ink-2)]">{waited}</span>
              )}
            </div>

            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 m-0">
              <dt className="t-small text-[var(--color-ink-3)]">Asked</dt>
              <dd className="t-small text-[var(--color-ink-2)] m-0">
                {override.askedAt ?? "—"}
                {override.askedWho ? ` · ${override.askedWho}` : " · every physician on duty"}
              </dd>

              {override.chasedAt && (
                <>
                  <dt className="t-small text-[var(--color-ink-3)]">Chased</dt>
                  <dd className="t-small text-[var(--color-ink-2)] m-0">{override.chasedAt}</dd>
                </>
              )}

              {override.reason && (
                <>
                  <dt className="t-small text-[var(--color-ink-3)]">You said</dt>
                  <dd className="t-small text-[var(--color-ink-2)] m-0">{override.reason}</dd>
                </>
              )}

              {override.denied && (
                <>
                  <dt className="t-small text-[var(--color-ink-3)]">Refused</dt>
                  <dd className="t-small text-[var(--color-ink-2)] m-0">
                    {override.deniedAt ?? "—"}
                    {override.deniedWho ? ` · ${override.deniedWho}` : ""}
                    {override.denyReason ? ` — ${override.denyReason}` : ""}
                  </dd>
                </>
              )}
            </dl>

            {!override.denied && (
              <>
                {/* A bell is no use to a physician in theatre. Ringing is. */}
                {override.askedPhone ? (
                  <a
                    href={`tel:${override.askedPhone}`}
                    className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-[var(--radius-sm)] border border-[var(--color-info)] bg-[var(--color-surface)] no-underline hover:no-underline self-start"
                  >
                    <span className="t-body text-[var(--color-info-text)]">
                      Ring {override.askedWho ?? "the physician"}
                      <span className="t-data text-[13px]"> · {override.askedPhone}</span>
                    </span>
                  </a>
                ) : (
                  <span className="t-small text-[var(--color-ink-3)]">
                    {override.askedWho
                      ? `${override.askedWho} has no number on file — ask an admin to add one.`
                      : "No physician is assigned to this session, so there is nobody to ring directly."}
                  </span>
                )}
              </>
            )}

            <span className="t-small text-[var(--color-ink-2)]">
              {override.denied
                ? "Ask for the code, or stand the session down. You may still open it yourself below — that is recorded against your name."
                : `Chasing tells every physician on duty, not just this one. No answer after ${RX_OVERRIDE_WAIT_MIN} minutes is reason enough to proceed yourself — ring first if you can. Nothing here stops you before then: if ${patientName} needs treating now, treat them.`}
            </span>
          </div>
        )}

        {!stuckOpen ? (
          <button
            type="button"
            onClick={() => setStuckOpen(true)}
            className="t-small text-[var(--color-ink-2)] bg-transparent border-0 p-0 cursor-pointer underline"
          >
            {patientName} cannot give a code?
          </button>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="t-body text-[var(--color-ink-2)]">
              A flat battery must not stop a session. Ask a physician first — and if nobody answers, you may proceed
              yourself. Either way it goes on the record, and {patientName} is told.
            </p>

            <label className="flex flex-col gap-[7px]">
              <span className="t-micro">Why can they not give a code?</span>
              <textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Phone is dead and there is no charger here."
                className="w-full px-[14px] py-3 rounded-[var(--radius-sm)] border border-[var(--color-line-2)] bg-[var(--color-surface)] text-[14.5px] leading-[1.55] resize-y"
              />
            </label>

            <Button
              variant="secondary"
              block
              loading={busy}
              disabled={reason.trim().length < 10}
              onClick={() => overrideCall({ mode: "ask", reason: reason.trim() })}
            >
              {override?.asked && !override?.denied ? "Chase the physician again" : "Ask a physician to open it"}
            </Button>

            <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] p-4 flex flex-col gap-3">
              <span className="t-micro text-[var(--color-critical-text)]">If no physician answers</span>
              <label className="flex flex-col gap-[7px]">
                <span className="t-micro">How did you confirm who this is?</span>
                <input
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value)}
                  placeholder="Checked Aadhaar card against the booking name and date of birth"
                  className="min-h-[44px] w-full px-[14px] rounded-[var(--radius-sm)] border border-[var(--color-line-2)] bg-[var(--color-surface)] text-[14.5px]"
                />
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={confirmGlass}
                  onChange={(e) => setConfirmGlass(e.target.checked)}
                  className="w-[18px] h-[18px] mt-[3px] accent-[var(--color-critical)] cursor-pointer flex-none"
                />
                <span className="t-small text-[var(--color-ink-2)]">
                  I am with {patientName}, I have confirmed their identity another way, and I understand this is
                  recorded against my name and shown to them.
                </span>
              </label>

              <Button
                variant="danger"
                block
                loading={busy}
                disabled={reason.trim().length < 10 || identity.trim().length < 3 || !confirmGlass}
                onClick={() =>
                  overrideCall({
                    mode: "break-glass",
                    reason: reason.trim(),
                    identityCheckedBy: identity.trim(),
                  })
                }
              >
                Open without a code
              </Button>
            </div>

            <button
              type="button"
              onClick={() => setStuckOpen(false)}
              className="t-small text-[var(--color-ink-2)] bg-transparent border-0 p-0 cursor-pointer underline self-start"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
