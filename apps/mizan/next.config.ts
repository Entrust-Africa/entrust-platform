import type { NextConfig } from "next";

// One .env at the repo root serves every app and package.
try {
  process.loadEnvFile("../../.env");
} catch {
  // Fall back to variables already in the environment.
}

const nextConfig: NextConfig = {};

export default nextConfig;
