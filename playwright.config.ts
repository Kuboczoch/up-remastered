import { defineConfig, devices } from "@playwright/test";

const port = 3000;
const baseURL = `http://127.0.0.1:${port}`;
const isCiRun =
  !!process.env.CI || process.env.npm_lifecycle_event === "test:e2e:ci";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  fullyParallel: true,
  forbidOnly: isCiRun,
  retries: isCiRun ? 2 : 0,
  workers: isCiRun ? 1 : undefined,
  reporter: [
    ["html", { open: "never" }],
    ["json", { outputFile: "playwright-report/results.json" }],
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: isCiRun ? "node .next/standalone/server.js" : "pnpm run dev",
    url: baseURL,
    reuseExistingServer: !isCiRun,
    timeout: 120_000,
  },
});
