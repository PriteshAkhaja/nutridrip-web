import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mongoose"],
  // The parent folder holds the previous build and its own lockfile; without
  // this, Turbopack infers that as the workspace root and pulls in its files.
  turbopack: { root: path.resolve(process.cwd()) },
  outputFileTracingRoot: path.resolve(process.cwd()),
  // Testing on a real phone means opening the dev server by its LAN address,
  // not localhost. Next blocks its dev-only JS for any other origin, and the
  // failure is silent: the server-rendered HTML still arrives and looks right,
  // but React never hydrates, so every button is inert while plain links still
  // work. It reads as "taps don't work on mobile" and is nothing of the kind.
  //
  // Private ranges only, as wildcards, so it survives the router handing out a
  // different address. Dev-only — `next start` does not consult this.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*"],
  images: {
    // The widths next/image cuts the public site's photographs to. The default
    // list jumps from 1200 to 1920 and runs on to 3840, but no source here is
    // wider than 1600 (public/images/README.md) and no layout shows a photo
    // wider than ~640 CSS px. A 1440 step spares a 2x laptop or a 3x phone the
    // 1920 file, and nothing asks for sizes the sources cannot fill.
    deviceSizes: [640, 750, 828, 1080, 1200, 1440, 1920],
  },
};

export default nextConfig;
