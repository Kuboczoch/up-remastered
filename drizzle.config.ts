import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "drizzle-kit";

const DEFAULT_DATABASE_URL = "file:/data/app.db";

function getDatabasePath() {
  const databaseUrl = process.env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL;
  const url = new URL(databaseUrl);
  let databasePath: string;

  if (url.protocol !== "file:") {
    throw new Error("DATABASE_URL must be a file: SQLite URL.");
  }

  if (databaseUrl.startsWith("file:/") && !databaseUrl.startsWith("file:///")) {
    databasePath = decodeURIComponent(url.pathname);
  } else {
    databasePath = fileURLToPath(url);
  }

  mkdirSync(dirname(databasePath), { recursive: true });

  return databasePath;
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
