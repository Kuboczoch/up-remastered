import { fileURLToPath } from "node:url";

import { defineConfig } from "drizzle-kit";

const DEFAULT_DATABASE_URL = "file:/data/app.db";

function getDatabasePath() {
  const databaseUrl = process.env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL;
  const url = new URL(databaseUrl);

  if (url.protocol !== "file:") {
    throw new Error("DATABASE_URL must be a file: SQLite URL.");
  }

  if (databaseUrl.startsWith("file:/") && !databaseUrl.startsWith("file:///")) {
    return url.pathname;
  }

  return fileURLToPath(url);
}

export default defineConfig({
  dialect: "sqlite",
  dbCredentials: {
    url: getDatabasePath(),
  },
  out: "./drizzle",
  schema: "./src/server/db/schema.ts",
  strict: true,
});
