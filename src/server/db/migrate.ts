import "server-only";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { statSync } from "node:fs";
import { join } from "node:path";

import { getDatabasePath } from "@/server/config/database";
import { createDbClient, createSqliteConnection } from "@/server/db/client";

const DEFAULT_MIGRATIONS_FOLDER = join(process.cwd(), "drizzle");
let migratedDatabaseFingerprint: string | undefined;

export function migrateDatabase(
  databasePath?: string,
  migrationsFolder = DEFAULT_MIGRATIONS_FOLDER,
) {
  const connection = createSqliteConnection(databasePath);

  try {
    const db = createDbClient(connection);
    migrate(db, { migrationsFolder });
  } finally {
    connection.close();
  }
}

export function ensureDatabaseMigrated(): void {
  const databasePath = getDatabasePath();
  const currentFingerprint = getDatabaseFingerprint(databasePath);

  if (migratedDatabaseFingerprint === currentFingerprint) {
    return;
  }

  migrateDatabase(databasePath);
  migratedDatabaseFingerprint = getDatabaseFingerprint(databasePath);
}

function getDatabaseFingerprint(databasePath: string): string {
  try {
    const stats = statSync(databasePath);

    return `${databasePath}:${stats.dev}:${stats.ino}`;
  } catch {
    return `${databasePath}:missing`;
  }
}
