import { getBrandColor } from "@/lib/settings/theme";
import { DEFAULT_BRAND, brandPalette } from "@/lib/theme";

export const dynamic = "force-dynamic";

/**
 * The favicon: the LogoMark (a vessel 62% full) in the brand colour the super
 * admin set (Admin → Settings), so the browser tab follows a theme change too.
 * An icon is loaded outside the page and cannot read its CSS variables, so it
 * is drawn here from the same palette. Cached briefly: a theme change reaches
 * open tabs within a few minutes.
 */
export async function GET() {
  const brand = await getBrandColor();
  // No colour set: the shipped mark exactly (globals.css's hand-tuned shades).
  const p = brand
    ? brandPalette(brand)
    : { "--color-primary": DEFAULT_BRAND, "--color-primary-soft": "#e4f6fc", "--color-primary-line": "#b3e6f3" };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" role="img" aria-label="NutriDrip"><defs><clipPath id="v"><rect x="1" y="1" width="30" height="30" rx="10"/></clipPath></defs><rect x="1" y="1" width="30" height="30" rx="10" fill="${p["--color-primary-soft"]}"/><rect x="1" y="12.4" width="30" height="18.6" fill="${p["--color-primary"]}" clip-path="url(#v)"/><rect x="1.5" y="1.5" width="29" height="29" rx="9.5" fill="none" stroke="${p["--color-primary-line"]}" stroke-width="1"/></svg>`;
  return new Response(svg, {
    headers: { "content-type": "image/svg+xml", "cache-control": "public, max-age=300" },
  });
}
