import "server-only";

import { fileURLToPath } from "node:url";

const DEFAULT_DATABASE_URL = "file:/data/app.db";

export function getDatabaseUrl(): string {
  const configuredUrl = process.env.DATABASE_URL?.trim();

  if (!configuredUrl) {
    return DEFAULT_DATABASE_URL;
  }

  return configuredUrl;
}

export function getDatabasePath(databaseUrl = getDatabaseUrl()): string {
  const url = new URL(databaseUrl);

  if (url.protocol !== "file:") {
    throw new Error("DATABASE_URL must be a file: SQLite URL.");
  }

  if (databaseUrl.startsWith("file:/") && !databaseUrl.startsWith("file:///")) {
    return url.pathname;
  }

  return fileURLToPath(url);
}
