"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * The patient answering the one thing their physician asked for.
 *
 * It exists so a missing detail does not cost somebody their slot. Before this,
 * a physician who needed one more answer had to decline — which cancelled the
 * booking and made the patient start the whole assessment again.
 */
export function InfoAnswer({ quizId }: { quizId: string }) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/quiz/${quizId}/answer`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answer: answer.trim() }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "That did not send");
      else router.refresh();
    } catch {
      setError("Could not reach the server. Nothing was sent.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-[7px]">
        <span className="t-micro">Your answer</span>
        <textarea
          rows={3}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Answer in your own words. If you are not sure, say so — that is useful too."
          className="w-full px-[14px] py-3 rounded-[var(--radius-sm)] border border-[var(--color-line-2)] bg-[var(--color-surface)] text-[14.5px] leading-[1.55] resize-y"
        />
      </label>

      {error && <span className="t-small text-[var(--color-critical-text)]">{error}</span>}

      <Button block loading={busy} disabled={answer.trim().length < 2} onClick={send}>
        Send to your physician
      </Button>

      <span className="t-small text-[var(--color-ink-3)]">
        Your session slot is held while they wait. Nothing has been cancelled.
      </span>
    </div>
  );
}
