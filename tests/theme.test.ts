import { describe, expect, it } from "vitest";
import {
  DEFAULT_BRAND,
  MIN_BUTTON_CONTRAST,
  brandCss,
  brandPalette,
  brandProblem,
  darkShade,
  DEFAULT_CONTRAST,
  contrastProblem,
  contrastShade,
  deepProblem,
  contrast,
  normalizeHex,
  readableShade,
  TINTED,
} from "@/lib/theme";

describe("normalizeHex", () => {
  it("accepts long and short forms, with or without #", () => {
    expect(normalizeHex("#0A7FA1")).toBe("#0a7fa1");
    expect(normalizeHex("0a7fa1")).toBe("#0a7fa1");
    expect(normalizeHex("#abc")).toBe("#aabbcc");
  });
  it("refuses anything else", () => {
    for (const v of ["", "red", "#12345", "#1234567", "rgb(1,2,3)", null, undefined])
      expect(normalizeHex(v)).toBeNull();
  });
});

describe("brandProblem", () => {
  it("accepts the shipped teal and other readable, non-clinical colours", () => {
    for (const c of [DEFAULT_BRAND, "#1d4ed8", "#6d28d9", "#0f766e", "#334155", "#be185d"])
      expect(brandProblem(c)).toBeNull();
  });
  it("refuses a colour white button text cannot be read on, and offers a shade that works", () => {
    const p = brandProblem("#7dd3fc");
    expect(p).toMatch(/buttons need at least 4.5:1/);
    const shade = readableShade("#7dd3fc");
    expect(p).toContain(shade);
    expect(contrast(shade, "#ffffff")).toBeGreaterThanOrEqual(MIN_BUTTON_CONTRAST);
  });
  it("refuses the clinical status hues", () => {
    expect(brandProblem("#b91c1c")).toMatch(/critical/);
    expect(brandProblem("#a16207")).toMatch(/caution/);
    expect(brandProblem("#15803d")).toMatch(/safe/);
  });
  it("refuses a malformed value", () => {
    expect(brandProblem("teal")).toMatch(/#RRGGBB/);
  });
});

describe("brandPalette", () => {
  const colours = [DEFAULT_BRAND, "#1d4ed8", "#6d28d9", "#0f766e", "#334155", "#be185d", "#4338ca"];
  it.each(colours)("keeps every derived pairing readable for %s", (c) => {
    const p = brandPalette(c);
    expect(contrast(p["--color-primary"], "#ffffff")).toBeGreaterThanOrEqual(MIN_BUTTON_CONTRAST);
    // Small accent text on white and on the pale ground.
    expect(contrast(p["--color-primary-text"], "#ffffff")).toBeGreaterThanOrEqual(7);
    expect(contrast(p["--color-primary-text"], p["--color-primary-soft"])).toBeGreaterThanOrEqual(6);
    // White and the lifted tint on the dark band.
    expect(contrast("#ffffff", p["--color-deep"])).toBeGreaterThanOrEqual(12);
    expect(contrast(p["--color-primary-on-dark"], p["--color-deep"])).toBeGreaterThanOrEqual(8);
    // Body ink on the mist ground.
    expect(contrast("#0a0c0e", p["--color-mist"])).toBeGreaterThanOrEqual(15);
    // The hover is darker than the colour, the grounds lighter.
    expect(contrast(p["--color-primary-dark"], "#ffffff")).toBeGreaterThan(contrast(p["--color-primary"], "#ffffff"));
  });
  it("stays close to the hand-tuned defaults for the shipped teal", () => {
    const p = brandPalette(DEFAULT_BRAND);
    expect(contrast(p["--color-deep"], "#062530")).toBeLessThan(1.15);
    expect(contrast(p["--color-primary-dark"], "#086780")).toBeLessThan(1.1);
  });
});

describe("brandCss", () => {
  it("overrides nothing for no colour, the default, or a refused colour", () => {
    expect(brandCss(null)).toBe("");
    expect(brandCss(DEFAULT_BRAND)).toBe("");
    expect(brandCss("#7dd3fc")).toBe("");
    expect(brandCss("#b91c1c")).toBe("");
  });
  it("writes one :root rule with every brand token for a custom colour", () => {
    const css = brandCss("#1D4ED8");
    expect(css.startsWith(":root{")).toBe(true);
    expect(css).toContain("--color-primary:#1d4ed8");
    // Every token, except a grey whose re-tint rounds back to the shipped value.
    for (const [k, v] of Object.entries(brandPalette("#1d4ed8")))
      if (TINTED[k as keyof typeof TINTED] !== v) expect(css).toContain(`${k}:${v}`);
    // Only hex values: nothing from the database can inject CSS.
    expect(css).toMatch(/^:root\{(--[a-z0-9-]+:#[0-9a-f]{6};?)+\}$/);
  });
});

describe("the greys, the ink and the info tone", () => {
  const hue = (c: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b),
      d = max - Math.min(r, g, b);
    if (!d) return 0;
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return h * 60;
  };
  const gap = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
  it("are exactly as shipped for the shipped brand", () => {
    const p = brandPalette(DEFAULT_BRAND);
    for (const [k, v] of Object.entries(TINTED)) expect(p[k as keyof typeof TINTED]).toBe(v);
  });
  it.each(["#6d28d9", "#1d4ed8", "#4338ca", "#0f766e", "#be185d", "#86198f"])(
    "lean toward %s and keep every contrast as shipped",
    (c) => {
      const p = brandPalette(c);
      for (const [k, shipped] of Object.entries(TINTED)) {
        const v = p[k as keyof typeof TINTED];
        expect(Math.abs(contrast(v, "#ffffff") - contrast(shipped, "#ffffff"))).toBeLessThan(0.08);
      }
      // The info tone and the mid greys carry the brand's hue.
      expect(gap(hue(p["--color-info"]), hue(c))).toBeLessThan(4);
      expect(gap(hue(p["--color-ink-2"]), hue(c))).toBeLessThan(8);
      // Readable pairings the screens rely on.
      expect(contrast(p["--color-info-text"], p["--color-info-soft"])).toBeGreaterThanOrEqual(7);
      expect(contrast(p["--color-ink-3"], "#ffffff")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p["--color-ink-2"], p["--color-surface-2"])).toBeGreaterThanOrEqual(7);
    }
  );
  it("stay as shipped for a brand with no hue, or one near a clinical hue", () => {
    for (const c of ["#555555", "#6b4f4c"]) {
      expect(brandProblem(c)).toBeNull();
      expect(brandPalette(c)["--color-info"]).toBe(TINTED["--color-info"]);
    }
  });
  it("never bring the info tone near red, amber or green, for any accepted brand", () => {
    const status = ["#c0453c", "#c07a22", "#2f8f5b"].map(hue);
    for (let h = 0; h < 360; h += 3)
      for (const [s, l] of [
        [0.7, 0.4],
        [0.3, 0.35],
        [0.15, 0.3],
      ]) {
        const k = (n: number) => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        const c =
          "#" +
          [f(0), f(8), f(4)]
            .map((x) =>
              Math.round(x * 255)
                .toString(16)
                .padStart(2, "0")
            )
            .join("");
        if (brandProblem(c)) continue;
        const info = hue(brandPalette(c)["--color-info"]);
        for (const x of status) expect(gap(info, x)).toBeGreaterThanOrEqual(18);
      }
  });
});

describe("the dark sections colour", () => {
  it("accepts dark colours and refuses ones too light for white text, offering a darker shade", () => {
    for (const c of ["#062530", "#111827", "#1e1b4b", "#14251f"]) expect(deepProblem(c)).toBeNull();
    const p = deepProblem("#1d4ed8");
    expect(p).toMatch(/at least 12:1/);
    expect(p).toContain(darkShade("#1d4ed8"));
    expect(contrast(darkShade("#1d4ed8"), "#ffffff")).toBeGreaterThanOrEqual(12);
  });
  it("is used as given, with its companions and a readable brand tint on it", () => {
    const p = brandPalette("#1d4ed8", "#111827");
    expect(p["--color-deep"]).toBe("#111827");
    expect(contrast("#ffffff", p["--color-deep-2"])).toBeGreaterThanOrEqual(9);
    expect(contrast(p["--color-primary-on-dark"], "#111827")).toBeGreaterThanOrEqual(8);
  });
  it("falls back to the one derived from the brand when unset or refused", () => {
    expect(brandPalette("#1d4ed8", null)["--color-deep"]).toBe(brandPalette("#1d4ed8")["--color-deep"]);
    expect(brandPalette("#1d4ed8", "#ffffff")["--color-deep"]).toBe(brandPalette("#1d4ed8")["--color-deep"]);
  });
  it("over the shipped brand, overrides only the dark tokens", () => {
    const css = brandCss(null, "#111827");
    expect(css).toContain("--color-deep:#111827");
    expect(css).toContain("--color-primary-on-dark:");
    expect(css).not.toContain("--color-primary:");
    expect(css).not.toContain("--color-mist:");
    expect(brandCss(null, "#1d4ed8")).toBe("");
  });
});

describe("the contrast colour (filled near-black UI)", () => {
  it("accepts near-black shades and refuses lighter ones, offering one that works", () => {
    for (const c of [DEFAULT_CONTRAST, "#0b1220", "#111827", "#1a0f1f"]) expect(contrastProblem(c)).toBeNull();
    const p = contrastProblem("#1e3a8a");
    expect(p).toMatch(/near-black/);
    const shade = contrastShade("#1e3a8a");
    expect(p).toContain(shade);
    expect(contrastProblem(shade)).toBeNull();
    // The footer's grey text stays readable on it.
    expect(contrast(shade, "#949a9f")).toBeGreaterThanOrEqual(4.5);
  });
  it("is written as its own token only when set", () => {
    expect(brandCss(null, null, DEFAULT_CONTRAST)).toBe("");
    expect(brandCss(null, null, "#111827")).toBe(":root{--color-contrast:#111827}");
    expect(brandCss(null, null, "#1e3a8a")).toBe("");
    const all = brandCss("#1d4ed8", "#111827", "#0b1220");
    expect(all).toContain("--color-primary:#1d4ed8");
    expect(all).toContain("--color-deep:#111827");
    expect(all).toContain("--color-contrast:#0b1220");
  });
});
