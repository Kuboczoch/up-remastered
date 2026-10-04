import { defineConfig } from "@playwright/test";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import base from "./playwright.config";

// Large isolated files are required to observe real (not buffered) upload bytes.
process.env.DATABASE_URL = pathToFileURL(
  join(process.cwd(), ".playwright-recipient-data/app.db"),
).toString();
process.env.UPLOAD_DIR = join(
  process.cwd(),
  ".playwright-recipient-data/uploads",
);
process.env.MAX_UPLOAD_SIZE = "10485760";
process.env.MAX_STORED_BYTES = "104857600";

const port = Number(process.env.PORT ?? 3346);
const baseURL = `http://127.0.0.1:${port}`;
process.env.UP_PUBLIC_ORIGIN = baseURL;

export default defineConfig({
  ...base,
  use: { ...base.use, baseURL },
  webServer: {
    command: "node .next/standalone/server.js",
    url: baseURL,
    env: { PORT: String(port), UP_PUBLIC_ORIGIN: baseURL },
    reuseExistingServer: false,
    timeout: 180_000,
  },
  testMatch: "**/recipient-progress.browser.ts",
  workers: 1,
  retries: 0,
  reporter: [
    ["list"],
    ["json", { outputFile: "playwright-report/recipient-results.json" }],
  ],
});
