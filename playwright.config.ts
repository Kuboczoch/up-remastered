import { defineConfig, devices } from "@playwright/test";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

const port = Number(process.env.PORT ?? 3000);
const baseURL = `http://127.0.0.1:${port}`;
const e2eDataDir = join(process.cwd(), ".playwright-data");

process.env.DATABASE_URL ??= pathToFileURL(
  join(e2eDataDir, "app.db"),
).toString();
process.env.DEFAULT_EXPIRATION_HOURS ??= "1";
process.env.MAX_EXPIRATION_HOURS ??= "24";
process.env.MAX_STORED_BYTES ??= "1048576";
process.env.MAX_UPLOAD_SIZE ??= "4096";
process.env.UPLOAD_DIR ??= join(e2eDataDir, "uploads");
process.env.UP_PUBLIC_ORIGIN ??= baseURL;

const isCiRun =
  !!process.env.CI || process.env.npm_lifecycle_event === "test:e2e:ci";
const isLighthouseRun = process.env.npm_lifecycle_event === "test:lighthouse";
const usesProductionServer = isCiRun || isLighthouseRun;
// CI always includes the stream contract; dev may opt in after a fresh build.
const includesStreamProject =
  isCiRun || (!isLighthouseRun && process.env.PLAYWRIGHT_LARGE_STREAM === "1");
const streamPort = port + 1;
const streamBaseURL = `http://127.0.0.1:${streamPort}`;
// Separate invocations must not inherit consumed files and exhaust this fixture's quota.
process.env.PLAYWRIGHT_STREAM_DATA_DIR ??= join(
  e2eDataDir,
  `stream-${randomUUID()}`,
);
const streamDataDir = process.env.PLAYWRIGHT_STREAM_DATA_DIR;
const streamUploadDir = join(streamDataDir, "uploads");
const largeCancellation =
  /dedicated large actual-stream cancellation has partial disk bytes and incomplete native XHR progress/;

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
      grepInvert: largeCancellation,
      metadata: { uploadDir: process.env.UPLOAD_DIR },
      use: { ...devices["Desktop Chrome"] },
    },
    ...(includesStreamProject
      ? [
          {
            name: "chromium-stream",
            testMatch: "src/app/request-cancel.spec.ts",
            grep: largeCancellation,
            metadata: { uploadDir: streamUploadDir },
            use: { ...devices["Desktop Chrome"], baseURL: streamBaseURL },
          },
        ]
      : []),
  ],
  webServer: [
    {
      command: isCiRun
        ? "node .next/standalone/server.js"
        : isLighthouseRun
          ? "pnpm run build && node .next/standalone/server.js"
          : "pnpm run dev",
      env: { PORT: String(port), HOSTNAME: "127.0.0.1" },
      url: baseURL,
      reuseExistingServer: !usesProductionServer,
      timeout: 180_000,
    },
    ...(includesStreamProject
      ? [
          {
            command: "node .next/standalone/server.js",
            env: {
              PORT: String(streamPort),
              HOSTNAME: "127.0.0.1",
              UP_PUBLIC_ORIGIN: streamBaseURL,
              DATABASE_URL: pathToFileURL(
                join(streamDataDir, "app.db"),
              ).toString(),
              UPLOAD_DIR: streamUploadDir,
              MAX_UPLOAD_SIZE: "1048576",
              MAX_STORED_BYTES: "2097152",
            },
            url: streamBaseURL,
            reuseExistingServer: false,
            timeout: 180_000,
          },
        ]
      : []),
  ],
});
