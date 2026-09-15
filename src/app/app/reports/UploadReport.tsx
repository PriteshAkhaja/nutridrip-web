"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Select, Textarea } from "@/components/ui/Field";

const CATEGORIES = ["Blood work", "Imaging", "Discharge summary", "Prescription", "Other"];
const MAX_MB = 4;
const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });

export function UploadReport() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const pick = (f: File | null) => {
    setError(null);
    if (!f) return setFile(null);
    if (!ALLOWED.includes(f.type)) {
      return setError("Upload a PDF or a photo — that file type is not accepted.");
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      return setError(`That file is ${(f.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_MB} MB.`);
    }
    setFile(f);
  };

  const upload = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const fileUrl = await readAsDataUrl(file);
      const res = await fetch("/api/lab-reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          fileUrl,
          category,
          notes: notes || undefined,
        }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not upload that");
      else {
        setFile(null);
        setNotes("");
        setOpen(false);
        if (inputRef.current) inputRef.current.value = "";
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. Nothing was uploaded.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <Button block size="lg" onClick={() => setOpen(true)}>
        Upload a report
      </Button>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="t-body font-semibold">Upload a report</span>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="t-small text-[var(--color-ink-2)] bg-transparent border-0 p-0 cursor-pointer underline"
        >
          Close
        </button>
      </div>

      <label className="flex flex-col gap-[7px]">
        <span className="t-micro">File</span>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,image/jpeg,image/png,image/webp"
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
          className="t-body file:mr-3 file:min-h-[36px] file:px-4 file:rounded-[var(--radius-sm)] file:border file:border-[var(--color-line-2)] file:bg-[var(--color-surface-2)] file:text-[var(--color-ink)] file:text-[13px] file:font-semibold file:cursor-pointer"
        />
        <span className="t-small text-[var(--color-ink-3)]">
          A PDF or a clear photo of each page. Up to {MAX_MB} MB.
        </span>
      </label>

      {file && (
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-primary-line)] bg-[var(--color-primary-soft)] px-3 py-2">
          <span className="t-body text-[var(--color-ink-2)]">
            {file.name} · <span className="t-data text-[13px]">{Math.round(file.size / 1024)} KB</span>
          </span>
        </div>
      )}

      <Select label="What is it" value={category} onChange={(e) => setCategory(e.target.value)}>
        {CATEGORIES.map((c) => (
          <option key={c}>{c}</option>
        ))}
      </Select>

      <Textarea
        label="Anything the physician should notice"
        hint="optional"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Ferritin is on page 2"
      />

      {error && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3">
          <span className="t-body text-[var(--color-ink-2)]">{error}</span>
        </div>
      )}

      <Button block loading={busy} disabled={!file} onClick={upload}>
        Upload
      </Button>

      <p className="t-small text-[var(--color-ink-3)]">
        This goes to the physician reviewing your protocol, and to nobody else.
      </p>
    </div>
  );
}
