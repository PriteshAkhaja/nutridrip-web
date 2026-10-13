/**
 * The brand colour the super admin can set (Admin → Settings), and every shade
 * the design system derives from it. Pure: no database, no DOM, so it is unit
 * tested (tests/theme.test.ts) and runs the same on the server and in the form.
 *
 * One colour in, the whole accent family out: the button colour, its hover,
 * the pale ground and hairline, the small-text tint, the lifted tint for dark
 * bands, and the dark band itself (the brand's hue taken almost to black).
 * The greys, the ink and the info tone lean a few degrees toward the brand, as
 * shipped they lean toward the teal; they keep their brightness exactly, so
 * every contrast stays as shipped. The status colours that carry a clinical
 * meaning (safe, caution, critical) are never derived.
 *
 * With no brand colour set, nothing is overridden and globals.css's
 * hand-tuned defaults apply unchanged.
 */

/** The shipped brand colour (globals.css --color-primary). */
export const DEFAULT_BRAND = "#0a7fa1";

/** White text on the brand colour (every primary button) needs this. */
export const MIN_BUTTON_CONTRAST = 4.5;

type RGB = [number, number, number];

export function normalizeHex(input: string | null | undefined): string | null {
  const v = (input ?? "").trim().toLowerCase();
  const short = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(v);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  const long = /^#?([0-9a-f]{6})$/.exec(v);
  return long ? `#${long[1]}` : null;
}

function rgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function hex([r, g, b]: RGB): string {
  return (
    "#" +
    [r, g, b]
      .map((v) =>
        Math.round(Math.min(255, Math.max(0, v)))
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
  );
}
/** a toward b by t (0..1), in sRGB. */
function mix(a: string, b: string, t: number): string {
  const x = rgb(a),
    y = rgb(b);
  return hex([x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t]);
}

export function luminance(color: string): number {
  const [r, g, b] = rgb(color).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string): number {
  const la = luminance(a),
    lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function toHsl(color: string): { h: number; s: number; l: number } {
  const [r, g, b] = rgb(color).map((v) => v / 255);
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
}
function fromHsl(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return hex([f(0) * 255, f(8) * 255, f(4) * 255]);
}

/** The first mix of `from` toward `to` (in 2% steps) that satisfies `ok`. */
function stepUntil(from: string, to: string, ok: (c: string) => boolean): string {
  for (let t = 0; t <= 1.0001; t += 0.02) {
    const c = mix(from, to, Math.min(t, 1));
    if (ok(c)) return c;
  }
  return to;
}

/** The clinical status hues (globals.css), which a brand colour must not imitate. */
const STATUS_HUES = [
  { name: "red used for critical readings", hue: toHsl("#c0453c").h },
  { name: "amber used for cautions", hue: toHsl("#c07a22").h },
  { name: "green used for safe readings", hue: toHsl("#2f8f5b").h },
];
const hueGap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

/**
 * Why a colour cannot be the brand colour, in words for the admin, or null if
 * it can. Two rules: white button text must stay readable, and the brand must
 * not look like a clinical status (an out-of-range vital is shown in red;
 * a red brand would make every button look like an alarm).
 */
export function brandProblem(input: string): string | null {
  const c = normalizeHex(input);
  if (!c) return "Enter a colour as #RRGGBB, for example #0a7fa1.";
  const ratio = contrast(c, "#ffffff");
  if (ratio < MIN_BUTTON_CONTRAST) {
    return `White text on this colour is ${ratio.toFixed(2)}:1; buttons need at least ${MIN_BUTTON_CONTRAST}:1 to be readable. A darker shade such as ${readableShade(c)} works.`;
  }
  const { h, s } = toHsl(c);
  if (s >= 0.35) {
    const clash = STATUS_HUES.find((x) => hueGap(h, x.hue) < 18);
    if (clash)
      return `Too close to the ${clash.name}. Clinical colours are reserved for patient status, so the brand cannot share one.`;
  }
  return null;
}

/** White text on the dark sections (the merge, closing panels) needs this: their body copy is small. */
export const MIN_DEEP_CONTRAST = 12;

/**
 * Why a colour cannot be the dark sections' ground, or null if it can. It
 * must be dark enough for white text, headings and the lifted brand tint.
 */
export function deepProblem(input: string): string | null {
  const c = normalizeHex(input);
  if (!c) return "Enter a colour as #RRGGBB, for example #062530.";
  const ratio = contrast(c, "#ffffff");
  if (ratio < MIN_DEEP_CONTRAST) {
    return `White text on this colour is ${ratio.toFixed(1)}:1; the dark sections need at least ${MIN_DEEP_CONTRAST}:1. A darker shade such as ${darkShade(c)} works.`;
  }
  return null;
}

/**
 * The contrast colour: the near-black of filled secondary buttons on hover,
 * selected filter chips, the announcement bar and the footer (not body text,
 * which stays --color-ink). Their white and muted-grey text (--color-ink-on-dark,
 * #949a9f) must stay readable, which keeps it close to black.
 */
export const DEFAULT_CONTRAST = "#0a0c0e";
export const MIN_CONTRAST_WHITE = 13;
const ON_DARK_GREY = "#949a9f";

export function contrastProblem(input: string): string | null {
  const c = normalizeHex(input);
  if (!c) return "Enter a colour as #RRGGBB, for example #0a0c0e.";
  const ratio = contrast(c, "#ffffff");
  if (ratio < MIN_CONTRAST_WHITE || contrast(c, ON_DARK_GREY) < 4.5) {
    return `This colour carries white and grey text (buttons on hover, the footer), so it must be near-black: white on it is ${ratio.toFixed(1)}:1 and needs ${MIN_CONTRAST_WHITE}:1. A darker shade such as ${contrastShade(c)} works.`;
  }
  return null;
}

/** The nearest darker shade the contrast colour can use. */
export function contrastShade(input: string): string {
  const c = normalizeHex(input) ?? DEFAULT_CONTRAST;
  return stepUntil(
    c,
    "#000000",
    (x) => contrast(x, "#ffffff") >= MIN_CONTRAST_WHITE + 0.3 && contrast(x, ON_DARK_GREY) >= 4.6
  );
}

/** The nearest darker shade that the dark sections can use. */
export function darkShade(input: string): string {
  const c = normalizeHex(input) ?? "#062530";
  return stepUntil(c, "#000000", (x) => contrast(x, "#ffffff") >= MIN_DEEP_CONTRAST + 0.2);
}

/** The nearest darker shade of a colour that white button text can sit on. */
export function readableShade(input: string): string {
  const c = normalizeHex(input) ?? DEFAULT_BRAND;
  return stepUntil(c, "#000000", (x) => contrast(x, "#ffffff") >= MIN_BUTTON_CONTRAST + 0.1);
}

/**
 * The tokens that lean toward the brand, as globals.css ships them (toward the
 * teal). The info tone is a status, but a calm one ("for your information"),
 * so it leans too; it never reaches red, amber or green (tintHue).
 */
export const TINTED = {
  "--color-surface-2": "#f5f7f9",
  "--color-line": "#e3e7eb",
  "--color-line-2": "#ccd3da",
  "--color-ink": "#0a0c0e",
  "--color-ink-2": "#434a50",
  "--color-ink-3": "#6b7178",
  "--color-ink-on-dark": "#949a9f",
  "--color-info": "#45699b",
  "--color-info-soft": "#ebf0f7",
  "--color-info-text": "#2f4a70",
} as const;

/**
 * A shipped tint moved to another hue: the same saturation, and the lightness
 * that gives the same luminance, so its contrast against anything is unchanged.
 */
function retint(shipped: string, hue: number): string {
  const { s } = toHsl(shipped);
  const target = luminance(shipped);
  let lo = 0,
    hi = 1;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (luminance(fromHsl(hue, s, mid)) < target) lo = mid;
    else hi = mid;
  }
  // 8-bit rounding can land a hair either side; take the closer of the two.
  const a = fromHsl(hue, s, lo),
    b = fromHsl(hue, s, hi);
  return Math.abs(luminance(a) - target) <= Math.abs(luminance(b) - target) ? a : b;
}

/**
 * The hue the greys and the info tone lean toward: the brand's. Null (keep
 * them as shipped) for the shipped brand, a brand too grey to have a hue, or
 * one near a clinical hue (a muted colour can be, since only a vivid one is
 * refused): the info tone must never drift toward red, amber or green.
 */
function tintHue(primary: string): number | null {
  if (primary === DEFAULT_BRAND) return null;
  const { h, s } = toHsl(primary);
  if (s < 0.12 || STATUS_HUES.some((x) => hueGap(h, x.hue) < 18)) return null;
  return h;
}

export type BrandPalette = {
  "--color-primary": string;
  "--color-primary-dark": string;
  "--color-primary-soft": string;
  "--color-primary-line": string;
  "--color-primary-text": string;
  "--color-primary-on-dark": string;
  "--color-deep": string;
  "--color-deep-2": string;
  "--color-deep-line": string;
  "--color-mist": string;
} & Record<keyof typeof TINTED, string>;

/**
 * Every brand token from one colour. The ratios follow the shipped teal: the
 * hover is the colour a fifth of the way to black; the soft ground and the
 * hairline are it a tenth and three tenths of the way from white; small text
 * is darkened until it reads at 7:1 on white; the dark band keeps the hue at
 * the shipped band's lightness; the on-dark tint is lightened until it reads
 * at 8:1 on that band.
 */
export function brandPalette(input: string, deepInput?: string | null): BrandPalette {
  const primary = normalizeHex(input) ?? DEFAULT_BRAND;
  const { h, s } = toHsl(primary);
  const soft = mix("#ffffff", primary, 0.1);
  const own = normalizeHex(deepInput);
  const band = own && !deepProblem(own) ? deepBand(own) : null;
  const deep = band?.deep ?? fromHsl(h, Math.min(s, 0.78), 0.105);
  const lean = tintHue(primary);
  const tinted = Object.fromEntries(
    Object.entries(TINTED).map(([key, shipped]) => [key, lean === null ? shipped : retint(shipped, lean)])
  ) as Record<keyof typeof TINTED, string>;
  return {
    ...tinted,
    "--color-primary": primary,
    "--color-primary-dark": mix(primary, "#000000", 0.2),
    "--color-primary-soft": soft,
    "--color-primary-line": mix("#ffffff", primary, 0.3),
    "--color-primary-text": stepUntil(primary, "#000000", (c) => contrast(c, "#ffffff") >= 7 && contrast(c, soft) >= 6),
    "--color-primary-on-dark": stepUntil(primary, "#ffffff", (c) => contrast(c, deep) >= 8),
    "--color-deep": deep,
    "--color-deep-2": band?.deep2 ?? fromHsl(h, Math.min(s * 0.9, 0.7), 0.148),
    "--color-deep-line": band?.deepLine ?? fromHsl(h, Math.min(s * 0.6, 0.48), 0.22),
    "--color-mist": fromHsl(h, Math.min(s, 0.42), 0.96),
  };
}

/**
 * A chosen dark-sections colour and its two companions, in the shipped
 * proportions: the raised panel a little lighter, the hairline lighter again.
 */
function deepBand(deep: string) {
  const { h, s, l } = toHsl(deep);
  return {
    deep,
    deep2: fromHsl(h, s * 0.9, Math.min(l + 0.043, 0.3)),
    deepLine: fromHsl(h, s * 0.62, Math.min(l + 0.115, 0.4)),
  };
}

/** The tokens that depend on the dark sections, for a custom one over the shipped brand. */
const DEEP_KEYS = ["--color-primary-on-dark", "--color-deep", "--color-deep-2", "--color-deep-line"] as const;

/**
 * The stylesheet that applies the brand colour and, optionally, a dark-sections
 * colour: one unlayered :root rule, which outranks globals.css's layered
 * tokens. A colour that fails its rule is ignored (a bad value in the database
 * must never reach the page). Empty when nothing differs from the shipped set.
 * The contrast colour (contrastInput) is its own token, written only when set.
 * With the shipped brand and a custom dark colour, only the dark tokens are
 * written, so globals.css's hand-tuned teal shades stay exactly as they are.
 */
export function brandCss(
  input: string | null | undefined,
  deepInput?: string | null,
  contrastInput?: string | null
): string {
  const c = normalizeHex(input);
  const brand = c && c !== DEFAULT_BRAND && !brandProblem(c) ? c : null;
  const d = normalizeHex(deepInput);
  const deep = d && !deepProblem(d) ? d : null;
  const k = normalizeHex(contrastInput);
  const dark = k && k !== DEFAULT_CONTRAST && !contrastProblem(k) ? k : null;
  if (!brand && !deep && !dark) return "";
  const entries: Array<readonly [string, string]> = [];
  if (brand || deep) {
    const palette = brandPalette(brand ?? DEFAULT_BRAND, deep);
    entries.push(
      ...(brand
        ? Object.entries(palette).filter(([key, v]) => TINTED[key as keyof typeof TINTED] !== v)
        : DEEP_KEYS.map((key) => [key, palette[key]] as const))
    );
  }
  if (dark) entries.push(["--color-contrast", dark]);
  return `:root{${entries.map(([key, v]) => `${key}:${v}`).join(";")}}`;
}
