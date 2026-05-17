import "server-only";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { join } from "node:path";

import { getDatabasePath } from "@/server/config/database";
import { createDbClient, createSqliteConnection } from "@/server/db/client";

const DEFAULT_MIGRATIONS_FOLDER = join(process.cwd(), "drizzle");
let migratedDatabasePath: string | undefined;

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

  if (migratedDatabasePath === databasePath) {
    return;
  }

  migrateDatabase(databasePath);
  migratedDatabasePath = databasePath;
}
