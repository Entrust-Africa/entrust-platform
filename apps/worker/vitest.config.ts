import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./test/env.ts"],
    // These tests run real jobs through pg-boss and wait up to 10 seconds for each; the default 5 seconds ends them first on a busy runner.
    testTimeout: 60_000,
  },
});
