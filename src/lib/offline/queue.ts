/**
 * The nurse app's outbox. A write that cannot reach the server is kept on the
 * device, in order, and replayed when the connection comes back — so a step
 * ticked in a basement flat is not lost, and the sequence the checklist
 * depends on is preserved.
 *
 * Storage is localStorage: the payloads are small (a signature is the largest,
 * well under the quota), it is synchronous, and it survives a page reload.
 */
export type QueuedRequest = {
  id: string;
  url: string;
  body: unknown;
  /** Shown to the nurse: "Step: Record baseline vitals". */
  label: string;
  createdAt: string;
};

export type PostResult =
  | { queued: true }
  | { queued: false; json: { success: boolean; data?: Record<string, unknown>; error?: string } };

export type FlushOutcome = {
  sent: number;
  /** Requests the server refused. Retrying will not change the answer, so they are dropped and reported. */
  rejected: Array<{ label: string; error: string }>;
  remaining: number;
};

const KEY = "nd_nurse_outbox";
const EMPTY: QueuedRequest[] = [];
const listeners = new Set<() => void>();
let cache: QueuedRequest[] | null = null;

function read(): QueuedRequest[] {
  if (cache) return cache;
  if (typeof window === "undefined") return EMPTY;
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    cache = Array.isArray(parsed) ? parsed : [];
  } catch {
    cache = [];
  }
  return cache;
}

function write(next: QueuedRequest[]) {
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Quota or blocked storage: the in-memory copy still serves this tab.
  }
  listeners.forEach((l) => l());
}

/** The current outbox. The same array is returned until it changes. */
export function getQueue(): QueuedRequest[] {
  return read();
}

export function getEmptyQueue(): QueuedRequest[] {
  return EMPTY;
}

export function subscribeQueue(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      cb();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function enqueue(url: string, body: unknown, label: string): QueuedRequest {
  const item: QueuedRequest = {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    url,
    body,
    label,
    createdAt: new Date().toISOString(),
  };
  write([...read(), item]);
  return item;
}

/**
 * POST now if the network is there; otherwise keep it. Anything already
 * waiting goes first, so a new request never overtakes an older one.
 */
export async function queuedPost(url: string, body: unknown, label: string): Promise<PostResult> {
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  if (offline || read().length > 0) {
    enqueue(url, body, label);
    return { queued: true };
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { queued: false, json: await res.json() };
  } catch {
    enqueue(url, body, label);
    return { queued: true };
  }
}

let flushing = false;

/** Replay the outbox in order. Stops at the first network failure; drops and reports server refusals. */
export async function flushQueue(): Promise<FlushOutcome> {
  const outcome: FlushOutcome = { sent: 0, rejected: [], remaining: read().length };
  if (flushing || typeof window === "undefined") return outcome;
  flushing = true;
  try {
    while (read().length > 0) {
      const [head] = read();
      try {
        const res = await fetch(head.url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(head.body),
        });
        const json = await res.json();
        if (json.success) outcome.sent += 1;
        else outcome.rejected.push({ label: head.label, error: json.error ?? "Rejected by the server" });
        // Drop the head from whatever the queue is NOW, not from the copy taken
        // before the request. A nurse ticking a step while this was in flight
        // appended to the outbox, and writing back `rest` would discard it —
        // losing exactly the work the outbox exists to protect.
        write(read().filter((q) => q.id !== head.id));
      } catch {
        break; // Still offline. Keep it, try again later.
      }
    }
  } finally {
    flushing = false;
  }
  outcome.remaining = read().length;
  return outcome;
}

/** navigator.onLine as an external store. */
export function subscribeOnline(cb: () => void): () => void {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}
export const readOnline = () => navigator.onLine;
export const readOnlineOnServer = () => true;
