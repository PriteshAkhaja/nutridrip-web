"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  ACCEPT_ATTR,
  ACCEPTED_TYPES,
  MAX_UPLOAD_BYTES,
  dragPosition,
  parsePosition,
  samePosition,
  sizeNote,
  sizeProblem,
  type Frame,
} from "@/lib/media/rules";
import type { ImageItem } from "./ImageManager";

type Quality = "sharp" | "good" | "small";

const fileSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/**
 * Changing one photograph, in a panel beside the library. The photo is shown
 * the way the page shows it, desktop and phone side by side (each place has its
 * own shapes, so the crops differ), and dragging either moves both. Below: how
 * sharp it will be, a new photo (dropped or chosen, with progress), what it
 * shows, and, kept apart, Restore original. Closing with changes unsaved asks
 * first.
 */
export function ImageEditor({
  item,
  groupName,
  viewPath,
  onClose,
}: {
  item: ImageItem;
  groupName: string;
  viewPath: string;
  onClose: (saved?: string) => void;
}) {
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number; box: DOMRect } | null>(null);

  const [shown, setShown] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const [alt, setAlt] = useState(item.image.alt);
  const [focal, setFocal] = useState(item.image.position);
  const [dragging, setDragging] = useState(false);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"close" | "restore" | null>(null);
  // After a save the panel stays, saying so, until the library behind it has the
  // new data: closing sooner shows the old photo for a moment, as if nothing happened.
  const [finishing, setFinishing] = useState<string | null>(null);
  const started = useRef({
    updated: item.updated,
    status: item.status,
    src: item.image.src,
    alt: item.image.alt,
    pos: item.image.position,
  });

  const dims = preview && size ? size : { w: item.image.width, h: item.image.height };
  const home = file ? "50% 50%" : item.startPosition;
  const dirty = !!file || alt.trim() !== item.image.alt.trim() || !samePosition(focal, item.image.position);
  const altOk = alt.trim().length >= 3;
  const canSave = dirty && altOk && !busy;
  const quality: Quality = sizeProblem(dims.w, dims.h, item.need)
    ? "small"
    : sizeNote(dims.w, dims.h, item.need)
      ? "good"
      : "sharp";

  // In: slide the panel in, hold the page still behind it, focus the panel.
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    const html = document.documentElement;
    const before = html.style.overflow;
    html.style.overflow = "hidden";
    closeBtn.current?.focus();
    return () => {
      cancelAnimationFrame(raf);
      html.style.overflow = before;
    };
  }, []);

  useEffect(() => {
    if (!finishing) return;
    const s = started.current;
    if (
      item.updated !== s.updated ||
      item.status !== s.status ||
      item.image.src !== s.src ||
      item.image.alt !== s.alt ||
      item.image.position !== s.pos
    ) {
      onClose(finishing);
      return;
    }
    // Nothing visibly changed (saved as it was): do not wait for ever.
    const t = setTimeout(() => onClose(finishing), 4000);
    return () => clearTimeout(t);
  }, [finishing, item, onClose]);

  // Let go of a local preview when it is replaced or the panel closes.
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );

  const requestClose = () => {
    if (busy || finishing) return;
    if (dirty) setConfirm("close");
    else onClose();
  };

  // Escape closes (asking first if there are changes); Tab stays inside the panel.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (confirm) setConfirm(null);
      else requestClose();
      return;
    }
    if (e.key !== "Tab" || !panel.current) return;
    const f = [
      ...panel.current.querySelectorAll<HTMLElement>(
        "button:not([disabled]), input:not([disabled]), a[href], [tabindex='0']"
      ),
    ].filter((el) => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0],
      last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const choose = async (f: File | undefined) => {
    if (!f) return;
    setFileError(null);
    setError(null);
    if (!(ACCEPTED_TYPES as readonly string[]).includes(f.type))
      return setFileError("Choose a JPEG, PNG, WebP or AVIF photo.");
    if (f.size > MAX_UPLOAD_BYTES)
      return setFileError(`That file is ${(f.size / 1024 / 1024).toFixed(1)} MB; the limit is 15 MB.`);
    const url = URL.createObjectURL(f);
    const s = await new Promise<{ w: number; h: number } | null>((res) => {
      const probe = new window.Image();
      probe.onload = () => res({ w: probe.naturalWidth, h: probe.naturalHeight });
      probe.onerror = () => res(null);
      probe.src = url;
    });
    if (!s) {
      URL.revokeObjectURL(url);
      return setFileError("That file could not be opened as a photo.");
    }
    const tooSmall = sizeProblem(s.w, s.h, item.need);
    if (tooSmall) {
      URL.revokeObjectURL(url);
      return setFileError(tooSmall);
    }
    setFile(f);
    setPreview(url);
    setSize(s);
    setFocal("50% 50%");
    // The old description was about the old photo.
    if (alt.trim() === item.image.alt.trim()) setAlt("");
  };

  const dropFile = () => {
    setFile(null);
    setPreview(null);
    setSize(null);
    setFocal(item.image.position);
    setAlt(item.image.alt);
    setFileError(null);
  };

  // Dragging either preview moves the photo in both.
  const onDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button > 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const at = parsePosition(focal);
    drag.current = { x: e.clientX, y: e.clientY, px: at.x, py: at.y, box: e.currentTarget.getBoundingClientRect() };
    setDragging(true);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const p = dragPosition(
      { x: d.px, y: d.py },
      { dx: e.clientX - d.x, dy: e.clientY - d.y },
      { w: d.box.width, h: d.box.height },
      dims
    );
    setFocal(`${p.x}% ${p.y}%`);
  };
  const onUp = () => {
    drag.current = null;
    setDragging(false);
  };
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 24 : 8;
    const by: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const m = by[e.key];
    if (!m) return;
    e.preventDefault();
    const box = e.currentTarget.getBoundingClientRect();
    const p = dragPosition(parsePosition(focal), { dx: m[0], dy: m[1] }, { w: box.width, h: box.height }, dims);
    setFocal(`${p.x}% ${p.y}%`);
  };

  const upload = () =>
    new Promise<{ ok: boolean; error?: string }>((resolve) => {
      const body = new FormData();
      body.set("slot", item.slot);
      body.set("file", file!);
      body.set("alt", alt);
      body.set("position", focal);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/admin/media");
      xhr.upload.onprogress = (e) => e.lengthComputable && setProgress(e.loaded / e.total);
      xhr.onload = () => {
        let json: { success?: boolean; error?: string } | null = null;
        try {
          json = JSON.parse(xhr.responseText);
        } catch {}
        resolve(
          xhr.status < 300 && json?.success
            ? { ok: true }
            : { ok: false, error: json?.error ?? "That did not upload. Try again." }
        );
      };
      xhr.onerror = () => resolve({ ok: false, error: "The connection dropped. Try again." });
      xhr.send(body);
    });

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (file) {
        setProgress(0);
        const r = await upload();
        if (!r.ok) throw new Error(r.error);
      } else {
        const res = await fetch("/api/admin/media", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slot: item.slot, alt, position: focal }),
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.success) throw new Error(json?.error ?? "That did not save. Try again.");
      }
      router.refresh();
      setFinishing(file ? "New photo is live on the website" : "Saved. Live on the website");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not save. Try again.");
      setBusy(false);
      setProgress(null);
    }
  };

  const restore = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/media?slot=${encodeURIComponent(item.slot)}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.error ?? "That did not restore. Try again.");
      router.refresh();
      setFinishing("Original photo restored");
    } catch (err) {
      setError(err instanceof Error ? err.message : "That did not restore. Try again.");
      setBusy(false);
      setConfirm(null);
    }
  };

  const src = preview ?? item.image.src;
  const bigger = item.frame.w * item.frame.h >= item.phone.w * item.phone.h;
  const deskMove = movable(item.frame, dims);
  const phoneMove = movable(item.phone, dims);
  const fits = !deskMove.x && !deskMove.y && !phoneMove.x && !phoneMove.y;

  return (
    <div className="fixed inset-0 z-[60]" onKeyDown={onKeyDown}>
      <div
        aria-hidden
        onClick={requestClose}
        className={`absolute inset-0 bg-[color-mix(in_srgb,var(--color-ink)_40%,transparent)] transition-opacity duration-200 motion-reduce:transition-none ${
          shown ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
        className={`absolute inset-y-0 right-0 flex w-full flex-col bg-[var(--color-surface)] shadow-[var(--shadow-modal)] transition-transform duration-300 ease-[var(--ease-glide)] motion-reduce:transition-none sm:w-[640px] ${
          shown ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-start gap-4 border-b border-[var(--color-line)] px-6 py-4">
          <div className="min-w-0 flex-1">
            <p className="t-micro m-0">{groupName}</p>
            <h2 id="editor-title" className="m-0 mt-1 text-[19px] font-semibold leading-snug text-[var(--color-ink)]">
              {item.title}
            </h2>
            {item.where ? <p className="t-small m-0 mt-0.5 text-[var(--color-ink-3)]">{item.where}</p> : null}
          </div>
          <a
            href={viewPath}
            target="_blank"
            rel="noreferrer"
            className="mt-1 hidden items-center gap-1.5 whitespace-nowrap text-[13.5px] font-semibold no-underline hover:underline sm:inline-flex"
          >
            View on site
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              aria-hidden
            >
              <path d="M4 2h6v6M10 2L3 9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <button
            ref={closeBtn}
            type="button"
            onClick={requestClose}
            aria-label="Close"
            className="-mr-2 inline-flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full text-[var(--color-ink-2)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-ink)]"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
          {/* As the page shows it */}
          <section aria-labelledby="as-shown">
            <div className="mb-2.5 flex items-baseline justify-between gap-3">
              <h3 id="as-shown" className="t-small m-0 font-semibold text-[var(--color-ink)]">
                As it appears on the page
              </h3>
              <button
                type="button"
                onClick={() => setFocal(home)}
                disabled={samePosition(focal, home)}
                className="cursor-pointer text-[13px] font-semibold text-[var(--color-primary-text)] hover:underline disabled:cursor-default disabled:text-[var(--color-ink-3)] disabled:no-underline"
              >
                Reset position
              </button>
            </div>
            <div className="flex items-end gap-4">
              <Preview
                label="Desktop"
                frame={item.frame}
                move={deskMove}
                widthPct={bigger ? 62 : 56}
                src={src}
                local={!!preview}
                focal={focal}
                dragging={dragging}
                onDown={onDown}
                onMove={onMove}
                onUp={onUp}
                onKey={onKey}
              />
              <Preview
                label="Phone"
                frame={item.phone}
                move={phoneMove}
                widthPct={bigger ? 38 : 44}
                src={src}
                local={!!preview}
                focal={focal}
                dragging={dragging}
                onDown={onDown}
                onMove={onMove}
                onUp={onUp}
                onKey={onKey}
              />
            </div>
            <p className="t-small m-0 mt-2.5 flex items-center gap-2 text-[var(--color-ink-3)]">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
              </svg>
              {fits
                ? "This photo fills the place exactly, so there is nothing to move."
                : "Drag either picture to choose what shows. Both move together."}
            </p>
          </section>

          {/* How sharp */}
          <QualityRow quality={quality} dims={dims} need={item.need} />

          {/* A new photo */}
          <section aria-labelledby="new-photo" className="mt-6">
            <h3 id="new-photo" className="t-small m-0 mb-2.5 font-semibold text-[var(--color-ink)]">
              {file ? "New photo" : "Replace the photo"}
            </h3>
            {file && size ? (
              <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-primary-line)] bg-[var(--color-primary-soft)] px-4 py-3">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-primary-text)"
                  strokeWidth="1.8"
                  aria-hidden
                >
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <circle cx="9" cy="10" r="1.8" />
                  <path d="M21 16l-5-5-8 8" strokeLinejoin="round" />
                </svg>
                <div className="min-w-0 flex-1">
                  <p className="m-0 truncate text-[14px] font-semibold text-[var(--color-ink)]">{file.name}</p>
                  <p className="t-small m-0 text-[var(--color-ink-2)]">
                    <span className="t-data">
                      {size.w} × {size.h} px
                    </span>{" "}
                    · {fileSize(file.size)}
                  </p>
                  {progress !== null ? (
                    <div className="mt-2 flex items-center gap-2">
                      <div
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(progress * 100)}
                        aria-label="Uploading"
                        className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-surface)]"
                      >
                        <div
                          className="h-full rounded-full bg-[var(--color-primary)] transition-[width] duration-150"
                          style={{ width: `${progress * 100}%` }}
                        />
                      </div>
                      <span className="t-data text-[12px] text-[var(--color-ink-2)]">
                        {Math.round(progress * 100)}%
                      </span>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={dropFile}
                  disabled={busy}
                  className="cursor-pointer text-[13px] font-semibold text-[var(--color-ink-2)] hover:text-[var(--color-ink)] hover:underline disabled:cursor-default disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(true);
                }}
                onDragLeave={() => setOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setOver(false);
                  void choose(e.dataTransfer.files?.[0]);
                }}
                className={`flex flex-col items-center gap-2 rounded-[var(--radius-lg)] border-2 border-dashed px-6 py-7 text-center transition-colors duration-150 ${
                  over
                    ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]"
                    : "border-[var(--color-line-2)] bg-[var(--color-surface-2)]"
                }`}
              >
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-ink-3)"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 16V4M7 9l5-5 5 5" />
                  <path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
                </svg>
                <p className="m-0 text-[14.5px] text-[var(--color-ink)]">
                  Drop a photo here, or{" "}
                  <button
                    type="button"
                    onClick={() => input.current?.click()}
                    className="cursor-pointer font-semibold text-[var(--color-primary-text)] underline-offset-2 hover:underline"
                  >
                    choose a file
                  </button>
                </p>
                <p className="t-small m-0 text-[var(--color-ink-3)]">
                  JPEG, PNG, WebP or AVIF · up to 15 MB · best{" "}
                  <span className="t-data">
                    {item.need.ideal.w} × {item.need.ideal.h} px
                  </span>{" "}
                  or larger
                </p>
              </div>
            )}
            {fileError ? (
              <p role="alert" className="t-small m-0 mt-2 text-[var(--color-critical-text)]">
                {fileError}
              </p>
            ) : null}
            <input
              ref={input}
              type="file"
              accept={ACCEPT_ATTR}
              className="hidden"
              onChange={(e) => {
                void choose(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </section>

          {/* What it shows */}
          <section className="mt-6">
            <label htmlFor="photo-alt" className="t-small mb-2 block font-semibold text-[var(--color-ink)]">
              What the photo shows
            </label>
            <input
              id="photo-alt"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              maxLength={300}
              placeholder="e.g. A nurse checking a patient's blood pressure at home"
              aria-invalid={dirty && !altOk ? true : undefined}
              className="h-11 w-full rounded-[var(--radius-md)] border border-[var(--color-line-2)] bg-[var(--color-surface)] px-3.5 text-[14.5px] placeholder:text-[var(--color-ink-3)]"
            />
            <p className="t-small m-0 mt-1.5 text-[var(--color-ink-3)]">
              {dirty && !altOk ? (
                <span className="text-[var(--color-caution-text)]">Describe the photo in a few words to save.</span>
              ) : (
                "Read aloud to people using screen readers, and by search engines."
              )}
            </p>
          </section>

          {/* Restore, kept apart */}
          {item.status !== "original" ? (
            <section className="mt-8 rounded-[var(--radius-lg)] border border-[var(--color-line)] p-4">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                <div className="min-w-0 flex-1">
                  <p className="t-small m-0 font-semibold text-[var(--color-ink)]">Restore the original</p>
                  <p className="t-small m-0 mt-0.5 text-[var(--color-ink-3)]">
                    Puts back the photo, position and description the site shipped with.
                    {item.updated ? ` Changed ${item.updated}.` : ""}
                  </p>
                </div>
                {confirm === "restore" ? (
                  <div className="flex gap-2">
                    <Button size="sm" variant="destructive" loading={busy} onClick={restore}>
                      Yes, restore
                    </Button>
                    <Button size="sm" variant="secondary" disabled={busy} onClick={() => setConfirm(null)}>
                      Keep
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="secondary" disabled={busy} onClick={() => setConfirm("restore")}>
                    Restore original
                  </Button>
                )}
              </div>
            </section>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-4">
          {confirm === "close" ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="t-small m-0 flex-1 font-medium text-[var(--color-ink)]">
                Discard your changes to this photo?
              </p>
              <Button size="md" variant="secondary" onClick={() => setConfirm(null)}>
                Keep editing
              </Button>
              <Button size="md" variant="destructive" onClick={() => onClose()}>
                Discard
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <p
                role={error ? "alert" : undefined}
                className={`t-small m-0 min-w-0 flex-1 ${error || dirty ? "" : "hidden sm:block"}`}
              >
                {error ? (
                  <span className="text-[var(--color-critical-text)]">{error}</span>
                ) : dirty ? (
                  <span className="text-[var(--color-ink-2)]">Unsaved changes</span>
                ) : (
                  <span className="text-[var(--color-ink-3)]">Changes go live as soon as they are saved.</span>
                )}
              </p>
              <Button size="md" variant="secondary" disabled={busy} onClick={requestClose}>
                Cancel
              </Button>
              <Button
                size="md"
                loading={(busy || !!finishing) && confirm !== "restore"}
                disabled={!canSave}
                onClick={save}
              >
                {finishing
                  ? "Saving…"
                  : busy && progress !== null && progress < 1
                    ? `Uploading ${Math.round(progress * 100)}%`
                    : file
                      ? "Upload and save"
                      : "Save changes"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/** Which ways a photo has spare picture to slide over in a frame (it covers the frame, so at most one). */
function movable(frame: Frame, photo: { w: number; h: number }): { x: boolean; y: boolean } {
  const scale = Math.max(frame.w / photo.w, frame.h / photo.h);
  return { x: photo.w * scale - frame.w >= 1, y: photo.h * scale - frame.h >= 1 };
}

/** The photo in one of the page's shapes, draggable, with its size named. */
function Preview({
  label,
  frame,
  move,
  widthPct,
  src,
  local,
  focal,
  dragging,
  onDown,
  onMove,
  onUp,
  onKey,
}: {
  label: string;
  frame: Frame;
  /** Which ways this picture has spare photo to slide over. */
  move: { x: boolean; y: boolean };
  widthPct: number;
  src: string;
  local: boolean;
  focal: string;
  dragging: boolean;
  onDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onUp: () => void;
  onKey: (e: React.KeyboardEvent<HTMLDivElement>) => void;
}) {
  return (
    <figure className="m-0 flex min-w-0 flex-col gap-1.5" style={{ width: `${widthPct}%` }}>
      <div
        tabIndex={0}
        role="group"
        aria-label={`${label} preview. Drag, or use the arrow keys, to choose what shows`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onKeyDown={onKey}
        className={`relative w-full select-none overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface-2)] outline-offset-2 focus-visible:outline-2 focus-visible:outline-[var(--color-primary)] ${
          !move.x && !move.y
            ? "cursor-default"
            : dragging
              ? "cursor-grabbing"
              : move.x && move.y
                ? "cursor-grab"
                : move.y
                  ? "cursor-ns-resize"
                  : "cursor-ew-resize"
        }`}
        style={{ aspectRatio: `${frame.w} / ${frame.h}`, touchAction: "none" }}
      >
        {local ? (
          // A file just chosen: shown as it is, not through the optimiser.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            draggable={false}
            className="absolute inset-0 h-full w-full object-cover"
            style={{ objectPosition: focal }}
          />
        ) : (
          <Image
            src={src}
            alt=""
            fill
            draggable={false}
            sizes="440px"
            quality={90}
            className="object-cover"
            style={{ objectPosition: focal }}
          />
        )}
      </div>
      <figcaption className="flex flex-col gap-0.5 text-[12px] leading-snug text-[var(--color-ink-3)]">
        <span className="flex items-baseline gap-1.5">
          <span className="font-semibold text-[var(--color-ink-2)]">{label}</span>
          <span className="t-data">
            {frame.w} × {frame.h}
          </span>
        </span>
        {move.x || move.y ? (
          <span>Moves {move.x && move.y ? "any way" : move.y ? "up and down" : "left and right"}</span>
        ) : (
          <span>Nothing to move</span>
        )}
      </figcaption>
    </figure>
  );
}

/** How sharp the photo will be in this place, in a word, a scale and the numbers behind them. */
function QualityRow({
  quality,
  dims,
  need,
}: {
  quality: Quality;
  dims: { w: number; h: number };
  need: ImageItem["need"];
}) {
  const word = { sharp: "Sharp", good: "Good", small: "Too small" }[quality];
  const steps = { sharp: 3, good: 2, small: 1 }[quality];
  const tone = {
    sharp: "var(--color-safe)",
    good: "var(--color-caution)",
    small: "var(--color-critical)",
  }[quality];
  const text = {
    sharp: "var(--color-safe-text)",
    good: "var(--color-caution-text)",
    small: "var(--color-critical-text)",
  }[quality];
  const say = {
    sharp: "Sharp on every screen.",
    good: "Fine on most screens, a little soft on high-resolution ones (phones, MacBooks).",
    small: "Too small for this place: it would look blurry.",
  }[quality];
  return (
    <div className="mt-5 flex items-center gap-4 rounded-[var(--radius-md)] bg-[var(--color-surface-2)] px-4 py-3">
      <div className="flex flex-none flex-col gap-1.5">
        <span className="text-[13px] font-semibold" style={{ color: text }}>
          {word}
        </span>
        <span className="flex gap-1" aria-hidden>
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              className="h-1.5 w-6 rounded-full"
              style={{ background: i <= steps ? tone : "var(--color-line-2)" }}
            />
          ))}
        </span>
      </div>
      <p className="t-small m-0 min-w-0 flex-1 text-[var(--color-ink-2)]" style={{ textWrap: "pretty" }}>
        {say}{" "}
        <span className="t-data block break-words text-[var(--color-ink-3)] sm:inline">
          {dims.w} × {dims.h} px · best {need.ideal.w} × {need.ideal.h}
        </span>
      </p>
    </div>
  );
}
