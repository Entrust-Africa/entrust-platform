import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    setupFiles: ["./test/env.ts"],
    testTimeout: 20_000,
    hookTimeout: 30_000,
    // The test files share one database and the QZ reference counter, so they run one at a time.
    fileParallelism: false,
  },
});
