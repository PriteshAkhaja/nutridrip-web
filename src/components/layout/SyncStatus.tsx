"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  flushQueue,
  getEmptyQueue,
  getQueue,
  readOnline,
  readOnlineOnServer,
  subscribeOnline,
  subscribeQueue,
  type FlushOutcome,
} from "@/lib/offline/queue";
import { OfflineBanner } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";

/** How often to try the outbox again when the network looks up but a send failed. */
const RETRY_MS = 20_000;

/** Refusals accumulate; sent counts reflect the latest flush. */
function merge(prev: FlushOutcome | null, next: FlushOutcome): FlushOutcome {
  if (!prev) return next;
  return { ...next, rejected: [...prev.rejected, ...next.rejected] };
}

/**
 * Offline is a normal condition, not an error. This strip says so, counts what
 * is waiting, and replays it the moment the connection returns.
 */
export function SyncStatus() {
  const router = useRouter();
  const queue = useSyncExternalStore(subscribeQueue, getQueue, getEmptyQueue);
  const online = useSyncExternalStore(subscribeOnline, readOnline, readOnlineOnServer);
  const [offlineSince, setOfflineSince] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<FlushOutcome | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const replay = () => {
      setBusy(true);
      flushQueue().then((o) => {
        if (cancelled) return;
        setBusy(false);
        if (o.sent || o.rejected.length) {
          setOutcome((prev) => merge(prev, o));
          router.refresh();
        }
      });
    };
    const onOnline = () => {
      setOfflineSince(null);
      replay();
    };
    const onOffline = () =>
      setOfflineSince(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }));

    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    // Anything left from a previous visit goes as soon as the app opens.
    if (navigator.onLine && getQueue().length > 0) replay();

    // A send can fail while the browser still believes it is online — a flaky
    // signal, a server hiccup. No "online" event follows that, so without a
    // heartbeat the outbox would sit there until the page was reloaded, while
    // the banner claimed it was syncing.
    const beat = setInterval(() => {
      if (navigator.onLine && getQueue().length > 0) replay();
    }, RETRY_MS);

    return () => {
      cancelled = true;
      clearInterval(beat);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [router]);

  if (!online) {
    return (
      <div className="mx-auto w-full max-w-[560px] px-5 pt-4">
        <OfflineBanner since={offlineSince ?? "just now"} queued={queue.length} />
      </div>
    );
  }

  // A refusal is the one thing that needs a person: retrying will not change
  // the answer. It is shown whether or not other work is still waiting, since
  // hiding it behind the queue banner would lose it entirely.
  const rejections = (outcome?.rejected ?? []).map((r, i) => (
    <div
      key={i}
      className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3"
    >
      <span className="t-body font-semibold">{r.label} was not accepted</span>
      <p className="t-body text-[var(--color-ink-2)] mt-1">{r.error} — check the session and redo it.</p>
    </div>
  ));

  if (queue.length > 0) {
    return (
      <div className="mx-auto w-full max-w-[560px] px-5 pt-4 flex flex-col gap-2">
        {rejections}
        <div className="flex items-center justify-between gap-4 flex-wrap rounded-[var(--radius-md)] border border-[var(--color-caution)] bg-[var(--color-caution-soft)] px-4 py-3">
          <div className="flex flex-col gap-1">
            <span className="t-micro text-[var(--color-caution-text)]">Back online · syncing</span>
            <span className="t-body">
              <span className="t-data text-[14.5px]">{queue.length}</span> waiting to send
              {queue[0] ? ` · next: ${queue[0].label}` : ""}
            </span>
          </div>
          <Button
            size="sm"
            variant="secondary"
            loading={busy}
            onClick={() => {
              setBusy(true);
              flushQueue().then((o) => {
                setBusy(false);
                setOutcome((prev) => merge(prev, o));
                if (o.sent || o.rejected.length) router.refresh();
              });
            }}
          >
            Retry now
          </Button>
        </div>
      </div>
    );
  }

  if (outcome && (outcome.sent > 0 || outcome.rejected.length > 0)) {
    return (
      <div className="mx-auto w-full max-w-[560px] px-5 pt-4 flex flex-col gap-2">
        {outcome.sent > 0 && (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-safe)] bg-[var(--color-safe-soft)] px-4 py-3 flex items-center justify-between gap-3">
            <span className="t-body">
              Synced <span className="t-data text-[14.5px]">{outcome.sent}</span> queued{" "}
              {outcome.sent === 1 ? "entry" : "entries"}.
            </span>
            <button
              type="button"
              onClick={() => setOutcome(null)}
              className="t-small text-[var(--color-ink-2)] bg-transparent border-0 p-0 cursor-pointer underline"
            >
              Dismiss
            </button>
          </div>
        )}
        {rejections}
      </div>
    );
  }

  return null;
}
