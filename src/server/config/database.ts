import "server-only";

import { fileURLToPath } from "node:url";

import { getServerEnv } from "@/env";

export function getDatabaseUrl(): string {
  return getServerEnv().DATABASE_URL;
}

export function getDatabasePath(databaseUrl = getDatabaseUrl()): string {
  const url = new URL(databaseUrl);

  if (databaseUrl.startsWith("file:/") && !databaseUrl.startsWith("file:///")) {
    return decodeURIComponent(url.pathname);
  }

  return fileURLToPath(url);
}
