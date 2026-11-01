import { defineConfig } from "drizzle-kit";

// One .env at the repo root serves every app and package.
try {
  process.loadEnvFile("../../.env");
} catch {
  // Fall back to variables already in the environment.
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./migrations",
  schemaFilter: ["core", "clear", "summit"],
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
