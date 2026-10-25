import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

const systemChromium = "/usr/bin/chromium";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    ...devices["Desktop Chrome"],
    launchOptions: {
      executablePath:
        process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
        (existsSync(systemChromium) && !process.env.CI ? systemChromium : undefined),
    },
  },
  outputDir: "test-results",
});
