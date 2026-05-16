import "server-only";

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";

import { getDatabasePath } from "@/server/config/database";
import * as schema from "@/server/db/schema";

export type SqliteDatabase = Database.Database;

export function createSqliteConnection(databasePath = getDatabasePath()) {
  return new Database(databasePath);
}

export function createDbClient(connection: SqliteDatabase) {
  return drizzle(connection, { schema });
}

export type DbClient = ReturnType<typeof createDbClient>;
