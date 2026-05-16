import { afterEach, describe, expect, it } from "@jest/globals";
import { eq } from "drizzle-orm";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getDatabasePath } from "@/server/config/database";
import { createDbClient, createSqliteConnection } from "@/server/db/client";
import { migrateDatabase } from "@/server/db/migrate";
import { uploadMetadata } from "@/server/db/schema";

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
          id: "upload_123",
          token: "share-token",
          originalName: "photo.png",
          storedName: "upload_123.bin",
          mimeType: "image/png",
          size: 12345,
          storagePath: "/data/uploads/upload_123.bin",
          createdAt,
          expiresAt,
          passwordHash: null,
          downloadLimit: 3,
        })
        .run();

      const storedUpload = db
        .select()
        .from(uploadMetadata)
        .where(eq(uploadMetadata.token, "share-token"))
        .get();

      expect(storedUpload).toMatchObject({
        id: "upload_123",
        token: "share-token",
        originalName: "photo.png",
        storedName: "upload_123.bin",
        mimeType: "image/png",
        size: 12345,
        storagePath: "/data/uploads/upload_123.bin",
        passwordHash: null,
        downloadLimit: 3,
        downloadCount: 0,
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
});
