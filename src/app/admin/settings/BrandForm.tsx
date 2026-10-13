"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LogoMark } from "@/components/layout/Logo";
import {
  DEFAULT_BRAND,
  DEFAULT_CONTRAST,
  brandPalette,
  brandProblem,
  contrastProblem,
  contrastShade,
  darkShade,
  deepProblem,
  normalizeHex,
  readableShade,
} from "@/lib/theme";

/** The derived tokens shown in the "Shades worked out" strip, with what each one is for. */
const SHADES = [
  ["--color-primary", "Buttons"],
  ["--color-primary-dark", "Hover"],
  ["--color-primary-text", "Small text"],
  ["--color-primary-line", "Hairlines"],
  ["--color-primary-soft", "Highlights"],
  ["--color-mist", "Light bands"],
  ["--color-deep", "Dark bands"],
  ["--color-deep-2", "Dark panels"],
  ["--color-primary-on-dark", "On dark"],
  ["--color-contrast", "Contrast"],
] as const;

/** The greys and the notice tone, which lean toward the brand at their shipped brightness. */
const GREYS = [
  ["--color-surface-2", "Panels, hover"],
  ["--color-line", "Borders"],
  ["--color-ink-3", "Muted text"],
  ["--color-info-soft", "Notices"],
  ["--color-info", "Info"],
] as const;

/** A few starting points that pass both rules. Any colour can be typed. */
const SUGGESTED = [
  { name: "NutriDrip teal", hex: DEFAULT_BRAND },
  { name: "Ocean blue", hex: "#1d4ed8" },
  { name: "Indigo", hex: "#4338ca" },
  { name: "Violet", hex: "#6d28d9" },
  { name: "Plum", hex: "#86198f" },
  { name: "Pine", hex: "#0f766e" },
  { name: "Slate", hex: "#334155" },
];

/**
 * The product's three colours (lib/theme), for the website, the patient and
 * nurse apps and every console: the brand colour, the dark sections, and the
 * contrast colour (the filled near-black UI). Every other shade is derived;
 * text and the clinical colours never change. The preview is a small page in
 * the picked colours, applied to the preview only: nothing changes for anyone
 * until Save.
 */
export function BrandForm({
  color,
  deep,
  contrast,
}: {
  color: string | null;
  deep: string | null;
  contrast: string | null;
}) {
  const router = useRouter();
  const saved = color ?? DEFAULT_BRAND;
  const [value, setValue] = useState(saved);
  const [deepAuto, setDeepAuto] = useState(deep === null);
  const [deepValue, setDeepValue] = useState(deep ?? brandPalette(saved)["--color-deep"]);
  const [darkValue, setDarkValue] = useState(contrast ?? DEFAULT_CONTRAST);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const hex = normalizeHex(value);
  const problem = brandProblem(value);
  const brandShown = hex && !problem ? hex : saved;
  const deepHex = normalizeHex(deepValue);
  const deepProb = deepAuto ? null : deepProblem(deepValue);
  const darkHex = normalizeHex(darkValue);
  const darkProb = contrastProblem(darkValue);
  const darkShown = darkHex && !darkProb ? darkHex : (contrast ?? DEFAULT_CONTRAST);
  const palette = useMemo(
    () => brandPalette(brandShown, deepAuto ? null : deepHex && !deepProb ? deepHex : deep),
    [brandShown, deepAuto, deepHex, deepProb, deep]
  );
  const previewVars = { ...palette, "--color-contrast": darkShown } as unknown as CSSProperties;

  const nextDeep = deepAuto ? null : deepHex;
  const nextDark = darkHex && darkHex !== DEFAULT_CONTRAST ? darkHex : null;
  const changed = (hex !== null && hex !== saved) || nextDeep !== deep || nextDark !== contrast;
  const blocked = !!problem || !!deepProb || (!deepAuto && !deepHex) || !!darkProb;
  const custom = !!(color || deep || contrast);

  const touch = () => {
    setDone(null);
    setError(null);
  };

  const save = async (next: string | null, nd: string | null, nk: string | null) => {
    setBusy(true);
    touch();
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ brandColor: next, deepColor: nd, contrastColor: nk }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(String(json.error ?? "Could not save that").replace(/^(brandColor|deepColor|contrastColor): /, ""));
        return;
      }
      const reset = next === null && nd === null && nk === null;
      if (reset) {
        setValue(DEFAULT_BRAND);
        setDeepAuto(true);
        setDeepValue(brandPalette(DEFAULT_BRAND)["--color-deep"]);
        setDarkValue(DEFAULT_CONTRAST);
      }
      setDone(reset ? "Back to the NutriDrip colours, on every page." : "Saved. Every page now uses these colours.");
      router.refresh();
    } catch {
      setError("Could not reach the server. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card padding="p-0" className="overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 px-6 pt-6">
        <div className="min-w-0">
          <h2 className="t-h3">Brand colours</h2>
          <p className="t-body text-[var(--color-ink-2)] mt-1 max-w-[62ch]" style={{ textWrap: "pretty" }}>
            Three colours set the look of the website, the patient and nurse apps and every console. Every lighter and
            darker shade is worked out from them.
          </p>
        </div>
        <span
          className="inline-flex flex-none items-center gap-2 rounded-full border px-3 py-1 text-[12.5px] font-semibold"
          style={
            changed
              ? { borderColor: "var(--color-ink)", color: "var(--color-ink)" }
              : { borderColor: "var(--color-line-2)", color: "var(--color-ink-2)" }
          }
        >
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: changed ? "var(--color-ink)" : "var(--color-ink-3)" }}
          />
          {changed ? "Unsaved changes" : custom ? "Custom colours live" : "NutriDrip colours live"}
        </span>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 px-6 pt-6 pb-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] xl:gap-8">
        <div className="flex flex-col gap-4">
          {/* The three colours */}
          <div className="divide-y divide-[var(--color-line)] rounded-[var(--radius-lg)] border border-[var(--color-line)]">
            <ColourRow
              id="brand"
              name="Brand colour"
              role="Main buttons, links, highlights, the logo"
              value={value}
              shown={brandShown}
              status={hex === DEFAULT_BRAND ? "Default" : "Custom"}
              problem={problem}
              fix={hex && !brandProblem(readableShade(hex)) ? readableShade(hex) : null}
              onChange={(v) => {
                setValue(v);
                touch();
              }}
            >
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {SUGGESTED.map((c) => {
                  const on = hex === c.hex;
                  return (
                    <button
                      key={c.hex}
                      type="button"
                      title={c.name}
                      aria-label={c.name}
                      aria-pressed={on}
                      onClick={() => {
                        setValue(c.hex);
                        touch();
                      }}
                      className="h-7 w-7 cursor-pointer rounded-full transition-transform duration-150 hover:scale-110"
                      style={{
                        background: c.hex,
                        boxShadow: on ? `0 0 0 2px var(--color-surface), 0 0 0 4px ${c.hex}` : undefined,
                      }}
                    />
                  );
                })}
              </div>
            </ColourRow>

            <ColourRow
              id="deep"
              name="Dark sections"
              role="The merge section, closing panels, the featured price"
              value={deepAuto ? palette["--color-deep"] : deepValue}
              shown={palette["--color-deep"]}
              status={deepAuto ? "Follows brand" : "Custom"}
              disabled={deepAuto}
              problem={deepProb}
              fix={deepHex && deepProb ? darkShade(deepHex) : null}
              onChange={(v) => {
                setDeepValue(v);
                touch();
              }}
            >
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={deepAuto}
                  onChange={(e) => {
                    setDeepAuto(e.target.checked);
                    if (!e.target.checked && !deep) setDeepValue(palette["--color-deep"]);
                    touch();
                  }}
                  className="h-4 w-4 accent-[var(--color-primary)]"
                />
                <span className="t-small text-[var(--color-ink-2)]">Work it out from the brand colour</span>
              </label>
            </ColourRow>

            <ColourRow
              id="contrast"
              name="Contrast colour"
              role="Buttons on hover, selected filters, the top bar, the footer"
              value={darkValue}
              shown={darkShown}
              status={darkHex === DEFAULT_CONTRAST ? "Default" : "Custom"}
              problem={darkProb}
              fix={darkHex && darkProb ? contrastShade(darkHex) : null}
              onChange={(v) => {
                setDarkValue(v);
                touch();
              }}
            >
              <p className="t-small mt-3 text-[var(--color-ink-3)]">
                Kept near-black, for the white and grey text on it.
                {darkHex !== DEFAULT_CONTRAST ? (
                  <>
                    {" "}
                    <button
                      type="button"
                      onClick={() => {
                        setDarkValue(DEFAULT_CONTRAST);
                        touch();
                      }}
                      className="cursor-pointer font-semibold text-[var(--color-primary)] underline underline-offset-2"
                    >
                      Back to black
                    </button>
                  </>
                ) : null}
              </p>
            </ColourRow>
          </div>

          {/* Every shade the system works out from the picks, so "worked out" is visible. */}
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-line)] p-4 sm:p-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="t-micro">Shades worked out</span>
              <span className="t-small hidden text-[var(--color-ink-3)] sm:inline">Point at one for its use</span>
            </div>
            <div className="mt-3 grid grid-cols-5 gap-1.5 sm:grid-cols-10 xl:grid-cols-5">
              {SHADES.map(([key, use]) => {
                const c = key === "--color-contrast" ? darkShown : palette[key];
                return (
                  <span key={key} className="flex flex-col items-center gap-1" title={`${use}: ${c.toUpperCase()}`}>
                    <span className="h-8 w-full rounded-[6px] border border-black/10" style={{ background: c }} />
                    <span className="text-center text-[10.5px] leading-tight text-[var(--color-ink-3)]">{use}</span>
                  </span>
                );
              })}
            </div>
            <span className="mt-4 block t-micro">Greys and notices, leaning toward the brand</span>
            <div className="mt-3 grid grid-cols-5 gap-1.5 sm:grid-cols-10 xl:grid-cols-5">
              {GREYS.map(([key, use]) => (
                <span
                  key={key}
                  className="flex flex-col items-center gap-1"
                  title={`${use}: ${palette[key].toUpperCase()}`}
                >
                  <span
                    className="h-8 w-full rounded-[6px] border border-black/10"
                    style={{ background: palette[key] }}
                  />
                  <span className="text-center text-[10.5px] leading-tight text-[var(--color-ink-3)]">{use}</span>
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* The preview: a small page in the picked colours */}
        <div className="self-start xl:sticky xl:top-6">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="t-micro">Live preview</span>
            <span className="t-small hidden text-[var(--color-ink-3)] sm:inline">
              Point at the buttons to see their hover
            </span>
          </div>
          <MiniPage style={previewVars} />
        </div>
      </div>

      {/* Save bar */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-[var(--color-line)] bg-[var(--color-surface-2)] px-6 py-4">
        <p className="t-small m-0 min-w-0 flex-1 text-[var(--color-ink-3)]" style={{ textWrap: "pretty" }}>
          {error ? (
            <span className="text-[var(--color-critical-text)]">{error}</span>
          ) : done ? (
            <span className="text-[var(--color-safe-text)]">{done}</span>
          ) : (
            "Text and the safe, caution and critical colours never change. Photographs stay as they are."
          )}
        </p>
        <div className="flex flex-none items-center gap-3">
          {custom ? (
            <Button size="md" variant="secondary" disabled={busy} onClick={() => save(null, null, null)}>
              Reset to NutriDrip colours
            </Button>
          ) : null}
          <Button size="md" loading={busy} disabled={!changed || blocked} onClick={() => save(hex, nextDeep, nextDark)}>
            Save colours
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** One colour: a swatch that opens the picker, its name and role, its code, its state. */
function ColourRow({
  id,
  name,
  role,
  value,
  shown,
  status,
  disabled = false,
  problem,
  fix,
  onChange,
  children,
}: {
  id: string;
  name: string;
  role: string;
  value: string;
  shown: string;
  status: string;
  disabled?: boolean;
  problem: string | null;
  fix: string | null;
  onChange: (v: string) => void;
  children?: ReactNode;
}) {
  return (
    <div className="p-4 sm:p-5">
      <div className="grid grid-cols-[48px_minmax(0,1fr)] items-center gap-x-4 gap-y-3 sm:grid-cols-[48px_minmax(0,1fr)_auto]">
        <label
          className={`relative h-12 w-12 flex-none overflow-hidden rounded-[var(--radius-md)] border border-black/10 ${
            disabled ? "cursor-default" : "cursor-pointer"
          }`}
          style={{ background: shown }}
          title={disabled ? undefined : `Pick the ${name.toLowerCase()}`}
        >
          <span className="sr-only">Pick the {name.toLowerCase()}</span>
          <input
            type="color"
            value={normalizeHex(value) ?? shown}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-default"
          />
        </label>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <label htmlFor={`${id}-hex`} className="t-body font-semibold text-[var(--color-ink)]">
              {name}
            </label>
            <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[11.5px] font-medium text-[var(--color-ink-2)]">
              {status}
            </span>
          </div>
          <p className="t-small m-0 text-[var(--color-ink-3)]">{role}</p>
        </div>
        <input
          id={`${id}-hex`}
          value={value.toUpperCase()}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
          aria-invalid={problem ? true : undefined}
          className="t-data col-start-2 h-10 w-[11ch] justify-self-start rounded-[var(--radius-md)] sm:col-start-auto sm:justify-self-end border border-[var(--color-line-2)] bg-[var(--color-surface)] px-2.5 text-center text-[14px] disabled:bg-[var(--color-surface-2)] disabled:text-[var(--color-ink-3)]"
        />
      </div>
      {children}
      {problem ? (
        <div
          role="status"
          className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-caution)] bg-[var(--color-caution-soft)] px-3.5 py-2.5"
        >
          <p className="t-small m-0 text-[var(--color-caution-text)]">{problem}</p>
          {fix ? (
            <button
              type="button"
              onClick={() => onChange(fix)}
              className="t-small mt-1.5 inline-flex cursor-pointer items-center gap-2 font-semibold text-[var(--color-caution-text)] underline underline-offset-2"
            >
              <span className="h-3.5 w-3.5 rounded-[3px] border border-black/10" style={{ background: fix }} />
              Use {fix.toUpperCase()} instead
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * A small page in the picked colours: the top bar, the header, a hero with both
 * buttons and the filters, a light section, a dark section and the footer.
 * Every colour comes from the tokens set on it, as on the real pages.
 */
function MiniPage({ style }: { style: CSSProperties }) {
  return (
    <div
      style={style}
      className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-paper)] text-[var(--color-ink)]"
      aria-label="Preview of the picked colours"
    >
      <div className="bg-[var(--color-contrast)] px-4 py-1.5 text-center text-[11px] text-white/85">
        Physician-reviewed before every session ·{" "}
        <span className="font-semibold text-[var(--color-primary-on-dark)]">How we keep it safe →</span>
      </div>

      <div className="flex items-center gap-3 border-b border-[var(--color-line)] px-4 py-2.5">
        <LogoMark size={20} />
        <span style={{ font: "600 14px/1 var(--font-display)" }}>NutriDrip</span>
        <span className="ml-2 hidden gap-1 text-[12px] text-[var(--color-ink-2)] sm:flex">
          <span className="rounded-full bg-[var(--color-primary-soft)] px-2.5 py-1 text-[var(--color-primary-text)]">
            Drips
          </span>
          <span className="px-2 py-1">Pricing</span>
          <span className="px-2 py-1">Safety</span>
        </span>
        <button
          type="button"
          tabIndex={-1}
          className="ml-auto inline-flex h-8 cursor-pointer items-center rounded-full bg-[var(--color-primary)] px-3 text-[12px] font-semibold text-white transition-colors duration-150 hover:bg-[var(--color-primary-dark)]"
        >
          Take the quiz
        </button>
      </div>

      <div className="px-5 pt-5 pb-5">
        <span className="inline-flex items-center rounded-full border border-[var(--color-primary-line)] bg-[var(--color-primary-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-primary-text)]">
          Physician-approved · nurse-administered
        </span>
        <p
          className="m-0 mt-3"
          style={{ font: "600 24px/1.05 var(--font-display)", letterSpacing: "-0.035em", textWrap: "balance" }}
        >
          IV nutrient therapy, at home.
        </p>
        <p className="m-0 mt-2 text-[12.5px] leading-[1.5] text-[var(--color-ink-2)]">
          A physician reviews you first.{" "}
          <span className="font-semibold text-[var(--color-primary)] underline underline-offset-2">How it works</span>
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            tabIndex={-1}
            className="inline-flex h-9 cursor-pointer items-center rounded-full bg-[var(--color-primary)] px-4 text-[12.5px] font-semibold text-white transition-colors duration-150 hover:bg-[var(--color-primary-dark)]"
          >
            Take the health quiz
          </button>
          <button
            type="button"
            tabIndex={-1}
            className="inline-flex h-9 cursor-pointer items-center rounded-full border border-[var(--color-line-2)] bg-[var(--color-surface)] px-4 text-[12.5px] font-semibold transition-colors duration-150 hover:border-[var(--color-contrast)] hover:bg-[var(--color-contrast)] hover:text-white"
          >
            Browse drips
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {["All 9", "Energy 4", "Skin 1"].map((c, i) => (
            <span
              key={c}
              className={`inline-flex h-7 items-center rounded-full border px-3 text-[11.5px] font-medium ${
                i === 0
                  ? "border-[var(--color-contrast)] bg-[var(--color-contrast)] text-white"
                  : "border-[var(--color-line-2)] text-[var(--color-ink-2)]"
              }`}
            >
              {c}
            </span>
          ))}
        </div>
      </div>

      <div className="bg-[var(--color-mist)] px-5 py-4">
        <div className="flex items-baseline justify-between text-[11.5px] text-[var(--color-ink-2)]">
          <span>Step 13 of 29</span>
          <span className="t-data">13 / 29</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface)]">
          <div className="h-full w-[45%] rounded-full bg-[var(--color-primary)]" />
        </div>
      </div>

      <div className="bg-[var(--color-deep)] px-5 py-5 text-white">
        <p className="m-0" style={{ font: "600 20px/1.05 var(--font-display)", letterSpacing: "-0.03em" }}>
          One drip. <span className="text-[var(--color-primary-on-dark)]">Myers&apos; Revive.</span>
        </p>
        <p className="m-0 mt-1.5 text-[11.5px] text-white/70">45 to 60 min, given at home by a nurse.</p>
      </div>

      <div className="flex items-center justify-between gap-3 bg-[var(--color-contrast)] px-5 py-3.5">
        <span className="flex items-center gap-2 text-white">
          <LogoMark size={16} />
          <span style={{ font: "600 12.5px/1 var(--font-display)" }}>NutriDrip</span>
        </span>
        <span className="text-[11px] text-[var(--color-ink-on-dark)]">Not a substitute for emergency care.</span>
      </div>
    </div>
  );
}
