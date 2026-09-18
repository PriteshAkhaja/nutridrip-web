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
};

export default nextConfig;
