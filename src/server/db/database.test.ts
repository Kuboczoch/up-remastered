import { afterEach, describe, expect, it } from "@jest/globals";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { eq } from "drizzle-orm";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getDatabasePath } from "@/server/config/database";
import { createDbClient, createSqliteConnection } from "@/server/db/client";
import { migrateDatabase } from "@/server/db/migrate";
import { uploadIdReservations, uploadMetadata } from "@/server/db/schema";
import { hasUploadId } from "@/server/db/uploads";

let tempDir: string | undefined;

afterEach(async () => {
  if (!tempDir) {
    return;
  }

  await rm(tempDir, { force: true, recursive: true });
  tempDir = undefined;
});

async function createTempDatabasePath() {
  tempDir = await mkdtemp(join(tmpdir(), "up-sqlite-"));

  return join(tempDir, "app.db");
}

describe("SQLite metadata persistence", () => {
  it("upgrades the previous journal without losing legacy metadata and is idempotent", async () => {
    const databasePath = await createTempDatabasePath();
    const previousFolder = join(tempDir!, "previous");
    await mkdir(join(previousFolder, "meta"), { recursive: true });
    const journal = JSON.parse(
      await readFile(join(process.cwd(), "drizzle/meta/_journal.json"), "utf8"),
    ) as {
      entries: Array<{ idx: number; tag: string; when: number }>;
    };
    expect(journal.entries.at(-1)?.tag).toBe("0007_download_limits");
    expect(
      journal.entries.every(
        (entry, i) =>
          entry.idx === i &&
          (i === 0 || entry.when > journal.entries[i - 1]!.when),
      ),
    ).toBe(true);
    const previous = { ...journal, entries: journal.entries.slice(0, -1) };
    await writeFile(
      join(previousFolder, "meta/_journal.json"),
      JSON.stringify(previous),
    );
    for (const entry of previous.entries)
      await copyFile(
        join(process.cwd(), "drizzle", `${entry.tag}.sql`),
        join(previousFolder, `${entry.tag}.sql`),
      );
    const connection = createSqliteConnection(databasePath);
    try {
      migrate(createDbClient(connection), { migrationsFolder: previousFolder });
      connection
        .prepare(
          `INSERT INTO upload_metadata (id, original_name, stored_name, mime_type, size, storage_path, created_at, expires_at)
        VALUES ('ABCDE', 'old.txt', 'ABCDE.bin', 'text/plain', 5, '/legacy/ABCDE.bin', 1, 2)`,
        )
        .run();
    } finally {
      connection.close();
    }
    migrateDatabase(databasePath);
    migrateDatabase(databasePath);
    const upgraded = createSqliteConnection(databasePath);
    try {
      expect(
        upgraded
          .prepare(
            "SELECT original_name, max_downloads, download_count FROM upload_metadata WHERE id = 'ABCDE'",
          )
          .get(),
      ).toEqual({
        original_name: "old.txt",
        max_downloads: null,
        download_count: 0,
      });
      expect(
        upgraded
          .prepare("SELECT count(*) AS count FROM __drizzle_migrations")
          .get(),
      ).toEqual({ count: journal.entries.length });
    } finally {
      upgraded.close();
    }
  });
  it("resolves the default database path from DATABASE_URL", () => {
    expect(getDatabasePath("file:/data/app.db")).toBe("/data/app.db");
  });

  it("decodes file URL paths", () => {
    expect(getDatabasePath("file:/data/app%20db.sqlite")).toBe(
      "/data/app db.sqlite",
    );
  });

  it("creates the schema and stores upload metadata", async () => {
    const databasePath = await createTempDatabasePath();
    const createdAt = new Date("2026-01-01T00:00:00.000Z");
    const expiresAt = new Date("2026-01-02T00:00:00.000Z");

    migrateDatabase(databasePath);

    const connection = createSqliteConnection(databasePath);
    const db = createDbClient(connection);

    try {
      db.insert(uploadMetadata)
        .values({
          id: "A7K2Q",
          originalName: "photo.png",
          storedName: "A7K2Q.bin",
          mimeType: "image/png",
          size: 12345,
          storagePath: "/data/uploads/A7K2Q.bin",
          createdAt,
          expiresAt,
        })
        .run();

      const storedUpload = db
        .select()
        .from(uploadMetadata)
        .where(eq(uploadMetadata.id, "A7K2Q"))
        .get();

      expect(storedUpload).toMatchObject({
        id: "A7K2Q",
        originalName: "photo.png",
        storedName: "A7K2Q.bin",
        mimeType: "image/png",
        size: 12345,
        storagePath: "/data/uploads/A7K2Q.bin",
      });
      expect(storedUpload?.createdAt).toEqual(createdAt);
      expect(storedUpload?.expiresAt).toEqual(expiresAt);
    } finally {
      connection.close();
    }
  });

  it("creates missing parent directories before opening SQLite", async () => {
    const databasePath = join(
      await createTempDatabasePath(),
      "nested",
      "app.db",
    );
    const connection = createSqliteConnection(databasePath);

    try {
      await expect(access(databasePath)).resolves.toBeUndefined();
    } finally {
      connection.close();
    }
  });

  it("keeps upload IDs reserved after metadata deletion", async () => {
    const databasePath = await createTempDatabasePath();

    migrateDatabase(databasePath);

    const connection = createSqliteConnection(databasePath);
    const db = createDbClient(connection);

    try {
      const metadata = {
        id: "A7K2Q",
        originalName: "photo.txt",
        storedName: "A7K2Q.bin",
        mimeType: "text/plain",
        size: 10,
        storagePath: "/data/uploads/A7K2Q.bin",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        expiresAt: new Date("2026-01-02T00:00:00.000Z"),
      };
      db.insert(uploadIdReservations)
        .values({ id: metadata.id, createdAt: metadata.createdAt })
        .run();
      db.insert(uploadMetadata).values(metadata).run();

      expect(hasUploadId(db, "A7K2Q")).toBe(true);

      db.delete(uploadMetadata).where(eq(uploadMetadata.id, "A7K2Q")).run();

      expect(hasUploadId(db, "A7K2Q")).toBe(true);
    } finally {
      connection.close();
    }
  });
});
