import { defineConfig, devices } from "@playwright/test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const port = 3000;
const baseURL = `http://127.0.0.1:${port}`;
const e2eDataDir = join(process.cwd(), ".playwright-data");

process.env.DATABASE_URL ??= pathToFileURL(
  join(e2eDataDir, "app.db"),
).toString();
process.env.DEFAULT_EXPIRATION_HOURS ??= "1";
process.env.MAX_EXPIRATION_HOURS ??= "24";
process.env.MAX_STORED_BYTES ??= "1048576";
process.env.MAX_UPLOAD_SIZE ??= "64";
process.env.UPLOAD_DIR ??= join(e2eDataDir, "uploads");
process.env.UP_PUBLIC_ORIGIN ??= baseURL;

const isCiRun =
  !!process.env.CI || process.env.npm_lifecycle_event === "test:e2e:ci";
const isLighthouseRun = process.env.npm_lifecycle_event === "test:lighthouse";
const usesProductionServer = isCiRun || isLighthouseRun;

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
    command: isCiRun
      ? "node .next/standalone/server.js"
      : isLighthouseRun
        ? "pnpm run build && node .next/standalone/server.js"
        : "pnpm run dev",
    url: baseURL,
    reuseExistingServer: !usesProductionServer,
    timeout: 180_000,
  },
});
