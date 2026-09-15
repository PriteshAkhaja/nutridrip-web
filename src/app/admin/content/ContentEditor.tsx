"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Pill } from "@/components/ui/Pill";

export function ContentEditor({
  groups,
  content,
  defaults,
}: {
  groups: Record<string, readonly string[]>;
  content: Record<string, string>;
  defaults: Record<string, string>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>({ ...content });
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const save = async (key: string) => {
    setSaving(key);
    setError(null);
    try {
      const res = await fetch("/api/admin/content", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key, value: values[key] ?? "" }),
      });
      const json = await res.json();
      if (!json.success) setError(json.error ?? "Could not save that");
      else {
        setValues((v) => ({ ...v, [key]: json.data.value }));
        router.refresh();
      }
    } catch {
      setError("Could not reach the server. Nothing was saved.");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-critical)] bg-[var(--color-critical-soft)] px-4 py-3">
          <span className="t-body text-[var(--color-ink-2)]">{error}</span>
        </div>
      )}

      {Object.entries(groups).map(([group, keys]) => (
        <section key={group}>
          <h2 className="t-h3 mb-3">{group}</h2>
          <Card padding="p-0">
            {keys.map((key, i) => {
              const edited = values[key] !== defaults[key];
              const dirty = values[key] !== content[key];
              const long = (defaults[key] ?? "").length > 90;

              return (
                <div
                  key={key}
                  className={`px-5 py-4 flex flex-col gap-2 ${
                    i > 0 ? "border-t border-[var(--color-line)]" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="t-data text-[13px] text-[var(--color-ink-3)]">{key}</span>
                    {edited && <Pill tone="caution">Edited</Pill>}
                  </div>

                  {long ? (
                    <textarea
                      rows={3}
                      value={values[key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                      className="w-full px-[14px] py-3 rounded-[var(--radius-sm)] border border-[var(--color-line-2)] bg-[var(--color-surface)] text-[14.5px] leading-[1.55] resize-y focus:border-[var(--color-primary)]"
                    />
                  ) : (
                    <input
                      type="text"
                      value={values[key] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                      className="w-full min-h-[44px] px-[14px] rounded-[var(--radius-sm)] border border-[var(--color-line-2)] bg-[var(--color-surface)] text-[14.5px] focus:border-[var(--color-primary)]"
                    />
                  )}

                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <span className="t-small text-[var(--color-ink-3)] max-w-[62ch]">
                      {edited ? `Was: ${defaults[key]}` : "Unchanged from the original"}
                    </span>
                    <div className="flex gap-2">
                      {edited && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setValues((v) => ({ ...v, [key]: "" }));
                            save(key);
                          }}
                        >
                          Revert
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant={dirty ? "primary" : "secondary"}
                        loading={saving === key}
                        disabled={!dirty}
                        onClick={() => save(key)}
                      >
                        {dirty ? "Save" : "Saved"}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </Card>
        </section>
      ))}
    </div>
  );
}
