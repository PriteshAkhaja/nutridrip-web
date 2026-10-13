import { ImageResponse } from "next/og";
import { getBrandColor } from "@/lib/settings/theme";
import { DEFAULT_BRAND, brandPalette } from "@/lib/theme";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";
// Per request: the brand colour is a setting (Admin → Settings), not a build-time value.
export const dynamic = "force-dynamic";

/**
 * The phone home-screen icon: the LogoMark (a vessel 62% full) filling the
 * square, in the brand colour the super admin set. iOS rounds the corners
 * itself. With no colour set, the shipped mark exactly.
 */
export default async function AppleIcon() {
  const brand = await getBrandColor();
  const p = brand ? brandPalette(brand) : { "--color-primary": DEFAULT_BRAND, "--color-primary-soft": "#e4f6fc" };
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: p["--color-primary-soft"],
      }}
    >
      <div style={{ flex: 38 }} />
      <div style={{ flex: 62, background: p["--color-primary"] }} />
    </div>,
    size
  );
}
