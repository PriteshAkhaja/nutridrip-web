// Every colour written into the source, in any form, outside the theme tokens.
// Flags the ones in the brand's family (teal / cyan / blue / the deep teal),
// which a brand-colour change would leave behind.
//   node tools/colour-audit.mjs   (run from nutridrip-new/)
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["src", "public"];
const EXT = /\.(tsx?|jsx?|mjs|css|svg|json|webmanifest|html)$/;
const files = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (EXT.test(e.name)) files.push(p.replace(/\\/g, "/"));
  }
};
ROOTS.forEach(walk);

const hexRgb = (h) => {
  h = h.replace("#", "");
  if (h.length === 3 || h.length === 4)
    h = h
      .slice(0, 3)
      .split("")
      .map((c) => c + c)
      .join("");
  if (h.length === 8) h = h.slice(0, 6);
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const hsl = ([r, g, b]) => {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min,
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = (max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  return { h, s, l };
};
// The brand family: teal through blue, with real colour in it.
const brandish = (rgb) => {
  const { h, s } = hsl(rgb);
  return s > 0.18 && h >= 165 && h <= 235;
};

const findings = [];
const TW =
  /\b(?:bg|text|border|ring|fill|stroke|from|via|to|outline|decoration|shadow|accent|caret|divide|placeholder)-(teal|cyan|sky|blue|indigo|emerald|green|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|violet|purple|fuchsia|pink|rose)-(\d{2,3})\b/g;
for (const f of files) {
  const text = fs.readFileSync(f, "utf8");
  const lines = text.split(/\r?\n/);
  // globals.css: only the @theme token block is allowed to hold brand hexes.
  let inTheme = false;
  lines.forEach((line, i) => {
    if (f.endsWith("globals.css")) {
      if (/^@theme\s*\{/.test(line)) inTheme = true;
      else if (inTheme && /^\}/.test(line)) inTheme = false;
    }
    const add = (kind, value, rgb) =>
      findings.push({
        f,
        line: i + 1,
        kind,
        value,
        brand: rgb ? brandish(rgb) : kind === "tailwind",
        inTheme,
        src: line.trim().slice(0, 140),
      });
    for (const m of line.matchAll(/#([0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g)) {
      // skip things that are clearly not colours (#id in URLs, entities)
      if (/&#|href=["']#|url\(#/.test(line.slice(Math.max(0, m.index - 6), m.index + 1))) continue;
      add("hex", m[0], hexRgb(m[0]));
    }
    for (const m of line.matchAll(/rgba?\(\s*(\d{1,3})[\s,_]+(\d{1,3})[\s,_]+(\d{1,3})/g))
      add("rgb", m[0], [+m[1], +m[2], +m[3]]);
    for (const m of line.matchAll(/hsla?\(\s*([\d.]+)(?:deg)?[\s,_]+([\d.]+)%[\s,_]+([\d.]+)%/g)) {
      const h = +m[1],
        s = +m[2] / 100;
      findings.push({
        f,
        line: i + 1,
        kind: "hsl",
        value: m[0],
        brand: s > 0.18 && h >= 165 && h <= 235,
        inTheme,
        src: line.trim().slice(0, 140),
      });
    }
    for (const m of line.matchAll(TW)) add("tailwind", m[0], null);
  });
}
const brand = findings.filter((x) => x.brand && !x.inTheme);
const byFile = {};
for (const x of brand) (byFile[x.f] ??= []).push(x);
console.log(
  `files scanned: ${files.length}; colour literals: ${findings.length}; brand-family outside the tokens: ${brand.length}`
);
for (const [f, xs] of Object.entries(byFile)) {
  console.log(`\n${f}`);
  for (const x of xs)
    console.log(`  ${String(x.line).padStart(4)}  ${x.kind.padEnd(8)} ${x.value.padEnd(22)} ${x.src}`);
}
const tw = findings.filter((x) => x.kind === "tailwind");
if (tw.length) {
  console.log(`\nTailwind palette classes (any hue): ${tw.length}`);
  for (const x of tw) console.log(`  ${x.f}:${x.line}  ${x.value}`);
}
fs.writeFileSync("scrollcraft/builds/home-v2/lab/colour-audit.json", JSON.stringify(findings, null, 1));
