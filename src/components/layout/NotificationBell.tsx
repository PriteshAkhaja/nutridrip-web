"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Item = {
  id: string;
  title: string;
  body: string;
  type: "info" | "success" | "warning" | "error";
  link: string;
  isRead: boolean;
  createdAt: string;
};

const DOT: Record<Item["type"], string> = {
  info: "var(--color-info)",
  success: "var(--color-safe)",
  warning: "var(--color-caution)",
  error: "var(--color-critical)",
};

function ago(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

/** A bell that cannot reach the server simply shows nothing new. */
async function fetchNotifications(): Promise<{ items: Item[]; unread: number } | null> {
  try {
    const res = await fetch("/api/notifications", { cache: "no-store" });
    const json = await res.json();
    return json.success ? { items: json.data.items, unread: json.data.unread } : null;
  } catch {
    return null;
  }
}

/**
 * The one surface that tells a person something happened elsewhere in the
 * system — an approval, an assignment, an adverse event, a dispatch.
 *
 * `media` is for a shell that places a bell differently by width. The console
 * keeps one in the phone/tablet bar and one in the desktop page header, and
 * CSS shows whichever fits — but a hidden bell would still poll, doubling the
 * requests. So a bell given `media` only fetches and polls while that query
 * matches, and starts or stops as the window crosses it.
 */
export function NotificationBell({ media }: { media?: string } = {}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Subscribe to the server: first load, then once a minute — while on screen.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;
    const refresh = () =>
      fetchNotifications().then((data) => {
        if (cancelled || !data) return;
        setItems(data.items);
        setUnread(data.unread);
      });
    const start = () => {
      if (timer) return;
      refresh();
      timer = setInterval(refresh, 60_000);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };
    const query = media ? window.matchMedia(media) : null;
    const sync = () => (query && !query.matches ? stop() : start());
    sync();
    query?.addEventListener("change", sync);
    return () => {
      cancelled = true;
      stop();
      query?.removeEventListener("change", sync);
    };
  }, [media]);

  // Click-away and Escape both close the panel.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const reload = () =>
    fetchNotifications().then((data) => {
      if (!data) return;
      setItems(data.items);
      setUnread(data.unread);
    });

  const markRead = async (body: Record<string, unknown>) => {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.success) setUnread(json.data.unread);
    } catch {
      // Marking read is a courtesy; failing to is not worth an error.
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) reload();
        }}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className="relative w-11 h-11 inline-flex items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-line-2)] bg-[var(--color-surface)] cursor-pointer hover:border-[var(--color-primary)] transition-colors duration-150"
      >
        <svg width="17" height="17" viewBox="0 0 20 20" fill="none" aria-hidden>
          <path
            d="M10 2.5a5 5 0 0 0-5 5v3l-1.2 2.2a.6.6 0 0 0 .53.9h11.34a.6.6 0 0 0 .53-.9L15 10.5v-3a5 5 0 0 0-5-5Z"
            stroke="var(--color-ink-2)"
            strokeWidth="1.4"
            strokeLinejoin="round"
          />
          <path d="M8 16a2 2 0 0 0 4 0" stroke="var(--color-ink-2)" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full inline-flex items-center justify-center text-white"
            style={{
              background: "var(--color-critical)",
              font: "500 10px/1 var(--font-mono)",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 mt-2 w-[340px] max-w-[calc(100vw-32px)] rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] z-50 overflow-hidden"
          style={{ boxShadow: "var(--shadow-modal)" }}
          role="dialog"
          aria-label="Notifications"
        >
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--color-line)]">
            <span className="t-micro">
              {unread ? `${unread} unread` : "All caught up"}
            </span>
            {unread > 0 && (
              <button
                type="button"
                onClick={async () => {
                  await markRead({ all: true });
                  setItems((xs) => xs.map((x) => ({ ...x, isRead: true })));
                }}
                className="t-small text-[var(--color-primary)] bg-transparent border-0 p-0 cursor-pointer underline"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[380px] overflow-y-auto">
            {items.length === 0 ? (
              <p className="t-body text-[var(--color-ink-2)] px-4 py-6">
                Nothing yet. Approvals, assignments and dispatches land here.
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={async () => {
                    if (!n.isRead) {
                      await markRead({ id: n.id });
                      setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
                    }
                    setOpen(false);
                    if (n.link) router.push(n.link);
                  }}
                  className="w-full text-left px-4 py-3 border-b border-[var(--color-line)] last:border-b-0 cursor-pointer hover:bg-[var(--color-surface-2)] transition-colors duration-150 flex gap-3 items-start"
                  style={{ background: n.isRead ? "transparent" : "var(--color-primary-soft)" }}
                >
                  <span
                    className="w-[6px] h-[6px] rounded-full flex-none mt-[6px]"
                    style={{ background: n.isRead ? "var(--color-line-2)" : DOT[n.type] }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span
                        className="t-body truncate"
                        style={{ fontWeight: n.isRead ? 400 : 600, color: "var(--color-ink)" }}
                      >
                        {n.title}
                      </span>
                      <span className="t-data text-[11px] text-[var(--color-ink-3)] flex-none">
                        {ago(n.createdAt)}
                      </span>
                    </span>
                    {n.body && <span className="t-small text-[var(--color-ink-2)] block mt-[2px]">{n.body}</span>}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
