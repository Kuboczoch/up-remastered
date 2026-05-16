import "server-only";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { createDbClient, createSqliteConnection } from "@/server/db/client";

const DEFAULT_MIGRATIONS_FOLDER = "drizzle";

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
