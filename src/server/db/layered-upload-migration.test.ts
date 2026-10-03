import { expect, it } from "@jest/globals";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createSqliteConnection } from "@/server/db/client";
import { migrateDatabase } from "@/server/db/migrate";

it("upgrades existing uploads without altering bytes metadata or their unlimited availability", async () => {
  const directory = await mkdtemp(join(tmpdir(), "up-layered-migration-"));
  const databasePath = join(directory, "app.db");
  const previousMigrations = join(directory, "previous-migrations");
  try {
    await mkdir(join(previousMigrations, "meta"), { recursive: true });
    const journal = JSON.parse(
      await readFile("drizzle/meta/_journal.json", "utf8"),
    );
    journal.entries = journal.entries.filter(
      (entry: { idx: number }) => entry.idx < 7,
    );
    await writeFile(
      join(previousMigrations, "meta", "_journal.json"),
      JSON.stringify(journal),
    );
    for (const entry of journal.entries) {
      await copyFile(
        `drizzle/${entry.tag}.sql`,
        join(previousMigrations, `${entry.tag}.sql`),
      );
    }
    migrateDatabase(databasePath, previousMigrations);
    const oldConnection = createSqliteConnection(databasePath);
    try {
      oldConnection
        .prepare(
          `INSERT INTO upload_metadata
        (id, original_name, stored_name, mime_type, size, storage_path, created_at, expires_at)
        VALUES ('A7K2Q', 'old.txt', 'A7K2Q.bin', 'text/plain', 5, '/data/uploads/A7K2Q.bin', 1000, 2000)`,
        )
        .run();
    } finally {
      oldConnection.close();
    }
    migrateDatabase(databasePath);
    migrateDatabase(databasePath);
    const upgraded = createSqliteConnection(databasePath);
    try {
      expect(
        upgraded
          .prepare(
            `SELECT id, original_name, stored_name, size, expires_at,
        max_downloads, download_count, encrypted FROM upload_metadata`,
          )
          .get(),
      ).toEqual({
        id: "A7K2Q",
        original_name: "old.txt",
        stored_name: "A7K2Q.bin",
        size: 5,
        expires_at: 2000,
        max_downloads: null,
        download_count: 0,
        encrypted: 0,
      });
    } finally {
      upgraded.close();
    }
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
