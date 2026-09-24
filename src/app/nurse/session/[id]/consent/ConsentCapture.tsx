"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { CURRENT_CONSENT_VERSION } from "@/lib/clinical/consent";
import { queuedPost } from "@/lib/offline/queue";
import { OtpBoxes } from "@/components/ui/OtpBoxes";



/**
 * A signature pad drawn on canvas. Pointer events cover mouse, touch and
 * stylus, which matters because this is signed on the nurse's phone.
 */
function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#16211E";
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    const { x, y } = pos(e);
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    const { x, y } = pos(e);
    ctx?.lineTo(x, y);
    ctx?.stroke();
    if (!hasInk) setHasInk(true);
  };

  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas && hasInk) onChange(canvas.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasInk(false);
    onChange(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="w-full h-[160px] rounded-[var(--radius-sm)] border border-[var(--color-line-2)] bg-[var(--color-surface)] touch-none cursor-crosshair"
        aria-label="Signature area"
      />
      <div className="flex justify-between items-center">
        <span className="t-small text-[var(--color-ink-3)]">Sign above</span>
        <button
          type="button"
          onClick={clear}
          className="t-small text-[var(--color-primary)] underline bg-transparent border-0 p-0 cursor-pointer"
        >
          Clear
        </button>
      </div>
    </div>
  );
}

export function ConsentCapture({
  bookingId,
  alreadyGivenAt,
}: {
  bookingId: string;
  alreadyGivenAt: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"signature" | "otp">("signature");
  const [signature, setSignature] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  // The code goes to the patient's app; the nurse only ever sees where it went.
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/consent-otp`, { method: "POST" });
      const json = (await res.json()) as { success: boolean; data?: { sentTo?: string }; error?: string };
      if (!json.success) setError(json.error ?? "Could not send the code");
      else {
        setSentTo(json.data?.sentTo ?? "the patient's phone");
        setOtp("");
      }
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (alreadyGivenAt) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-safe)] bg-[var(--color-safe-soft)] p-5">
        <span className="t-body font-semibold">Consent already captured</span>
        <p className="t-body text-[var(--color-ink-2)] mt-1">
          Version {CURRENT_CONSENT_VERSION} ·{" "}
          {new Date(alreadyGivenAt).toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })}
        </p>
        <div className="mt-3">
          <Button variant="secondary" block onClick={() => router.push(`/nurse/session/${bookingId}`)}>
            Back to checklist
          </Button>
        </div>
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      // A code is checked against the one sent a moment ago, so it is sent now,
      // not queued for later: by the time a queue replays, it may have expired.
      if (mode === "otp") {
        const res = await fetch(`/api/bookings/${bookingId}/consent`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ version: CURRENT_CONSENT_VERSION, viaOtp: otp }),
        });
        const json = (await res.json()) as { success: boolean; error?: string };
        if (!json.success) setError(json.error ?? "Could not record consent");
        else router.push(`/nurse/session/${bookingId}`);
        return;
      }
      const result = await queuedPost(
        `/api/bookings/${bookingId}/consent`,
        {
          // A signature needs no answer from the server, so it can wait offline.
          version: CURRENT_CONSENT_VERSION,
          signatureDataUrl: signature ?? undefined,
        },
        "Consent"
      );
      if (result.queued) {
        setError("Offline — consent is queued and will sync when you reconnect.");
      } else if (!result.json.success) {
        setError(result.json.error ?? "Could not record consent");
      } else {
        router.push(`/nurse/session/${bookingId}`);
      }
    } catch {
      setError("Could not record consent. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const ready = mode === "signature" ? Boolean(signature) : Boolean(sentTo) && otp.length === 6;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1 p-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-2)] border border-[var(--color-line)]">
        {(["signature", "otp"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 min-h-[36px] rounded-[6px] text-[13px] font-semibold ${
              mode === m ? "bg-[var(--color-surface)] text-[var(--color-ink)]" : "text-[var(--color-ink-2)]"
            }`}
          >
            {m === "signature" ? "Signature" : "Code to phone"}
          </button>
        ))}
      </div>

      {mode === "signature" ? (
        <SignaturePad onChange={setSignature} />
      ) : (
        <div className="flex flex-col gap-3">
          {!sentTo ? (
            <>
              <p className="t-body text-[var(--color-ink-2)]">
                A code goes to the patient&rsquo;s NutriDrip app. When they read it out to you, that is their
                consent, and not yours.
              </p>
              <Button variant="secondary" block loading={busy} onClick={sendCode}>
                Send the code to the patient
              </Button>
            </>
          ) : (
            <>
              <div className="rounded-[var(--radius-md)] border border-[var(--color-info)] bg-[var(--color-info-soft)] px-4 py-3">
                <span className="t-body text-[var(--color-ink-2)]">
                  Code sent to <span className="t-data text-[13px]">{sentTo}</span>. It shows at the top of the
                  patient&rsquo;s home screen and lasts ten minutes. Ask them to read it to you.
                </span>
              </div>
              <div className="flex flex-col gap-[7px]">
                <span className="t-micro">The six digits they read out</span>
                <OtpBoxes value={otp} onChange={setOtp} autoFocus />
              </div>
              <Button variant="ghost" size="sm" loading={busy} onClick={sendCode} className="self-start">
                Send a new code
              </Button>
            </>
          )}
        </div>
      )}

      {error && <span className="t-small text-[var(--color-caution-text)]">{error}</span>}

      <Button size="lg" block loading={busy} disabled={!ready} onClick={submit}>
        Record consent
      </Button>
    </div>
  );
}
