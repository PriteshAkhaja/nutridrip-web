import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mongoose"],
  // The parent folder holds the previous build and its own lockfile; without
  // this, Turbopack infers that as the workspace root and pulls in its files.
  turbopack: { root: path.resolve(process.cwd()) },
  outputFileTracingRoot: path.resolve(process.cwd()),
};

export default nextConfig;
