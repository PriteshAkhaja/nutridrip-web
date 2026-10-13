import { brandCss, TINTED, brandPalette } from "../../../../src/lib/theme";
const p = brandPalette("#6d28d9") as Record<string, string>;
for (const k of Object.keys(TINTED)) console.log(k.padEnd(22), (TINTED as Record<string, string>)[k], "->", p[k]);
console.log(brandCss("#6d28d9", null, "#002e5c"));
