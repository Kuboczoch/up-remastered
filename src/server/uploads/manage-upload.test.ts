import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDbClient, createSqliteConnection } from "@/server/db/client";
import { migrateDatabase } from "@/server/db/migrate";
import { uploadMetadata } from "@/server/db/schema";
import { createDownloadResponse } from "@/server/downloads/create-download-response";
import { getUploadMetadata } from "@/server/db/uploads";
import { hashUploadAccessToken } from "@/server/uploads/access-token";
import {
  deleteUploadWithAccessToken,
  getPublicUploadDetails,
  verifyUploadAccess,
} from "@/server/uploads/manage-upload";

const NOW = new Date("2026-01-01T00:00:00.000Z");
const TOKEN = "a".repeat(128);
let tempDir = "";

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "up-manage-"));
  process.env.DATABASE_URL = `file:${join(tempDir, "app.db")}`;
  process.env.UPLOAD_DIR = join(tempDir, "uploads");
  await mkdir(process.env.UPLOAD_DIR, { recursive: true });
  migrateDatabase(join(tempDir, "app.db"));
});

afterEach(async () => {
  await rm(tempDir, { force: true, recursive: true });
});

function insertUpload(expiresAt = new Date("2026-01-02T00:00:00.000Z")) {
  const connection = createSqliteConnection();
  const db = createDbClient(connection);
  db.insert(uploadMetadata)
    .values({
      accessTokenHash: hashUploadAccessToken(TOKEN),
      createdAt: NOW,
      expiresAt,
      id: "A7K2Q",
      mimeType: "text/plain; charset=utf-8",
      originalName: "report.txt",
      size: 5,
      storagePath: join(process.env.UPLOAD_DIR!, "A7K2Q.bin"),
      storedName: "A7K2Q.bin",
    })
    .run();
  connection.close();
}

function readRow() {
  const connection = createSqliteConnection();
  try {
    return getUploadMetadata(createDbClient(connection), "A7K2Q");
  } finally {
    connection.close();
  }
}

describe("upload management", () => {
  it("hides exhausted uploads and their counter/token from public access", () => {
    insertUpload();
    const connection = createSqliteConnection();
    connection
      .prepare(
        "UPDATE upload_metadata SET max_downloads = 1, download_count = 1",
      )
      .run();
    connection.close();
    expect(getPublicUploadDetails("A7K2Q", NOW)).toBeUndefined();
    expect(verifyUploadAccess("A7K2Q", TOKEN, NOW)).toBe("not-found");
  });
  it("fences download admission during deletion and preserves count on failed deletion", async () => {
    insertUpload();
    const path = join(process.env.UPLOAD_DIR!, "A7K2Q.bin");
    await writeFile(path, "hello");
    const admitted = await createDownloadResponse("A7K2Q", null, NOW);
    expect(await admitted.text()).toBe("hello");
    await expect(
      deleteUploadWithAccessToken("A7K2Q", TOKEN, NOW, {
        rename: async (from, to) => {
          expect(
            (await createDownloadResponse("A7K2Q", null, NOW)).status,
          ).toBe(404);
          await rename(from, to);
        },
        unlink: async () => {
          throw new Error("failed unlink");
        },
      }),
    ).rejects.toThrow("failed unlink");
    expect(readRow()).toMatchObject({ downloadCount: 1, cleanupClaimId: null });
    const retry = await createDownloadResponse("A7K2Q", null, NOW);
    expect(await retry.text()).toBe("hello");
    expect(readRow()?.downloadCount).toBe(2);
  });
  it("returns public details without exposing the access token hash", () => {
    insertUpload();

    expect(getPublicUploadDetails("A7K2Q", NOW)).toEqual({
      expirationDate: "2026-01-02T00:00:00.000Z",
      key: "A7K2Q",
      maxDownloads: null,
      name: "report.txt",
      permanent: false,
      size: 5,
      type: "text/plain; charset=utf-8",
    });
    expect(
      getPublicUploadDetails("A7K2Q", new Date("2026-01-03")),
    ).toBeUndefined();
  });

  it("distinguishes valid, forbidden, and missing access", () => {
    insertUpload();

    expect(verifyUploadAccess("A7K2Q", TOKEN, NOW)).toBe("valid");
    expect(verifyUploadAccess("A7K2Q", "wrong", NOW)).toBe("forbidden");
    expect(verifyUploadAccess("ZZZZZ", TOKEN, NOW)).toBe("not-found");
  });

  it("deletes content and metadata with a valid token", async () => {
    insertUpload();
    const path = join(process.env.UPLOAD_DIR!, "A7K2Q.bin");
    await writeFile(path, "hello");

    await expect(
      deleteUploadWithAccessToken("A7K2Q", TOKEN, NOW),
    ).resolves.toBe("valid");
    expect(readRow()).toBeUndefined();
    await expect(access(path)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("restores content and metadata when physical deletion fails", async () => {
    insertUpload();
    const path = join(process.env.UPLOAD_DIR!, "A7K2Q.bin");
    await writeFile(path, "hello");

    await expect(
      deleteUploadWithAccessToken("A7K2Q", TOKEN, NOW, {
        rename,
        unlink: async () => {
          throw new Error("simulated unlink failure");
        },
      }),
    ).rejects.toThrow("simulated unlink failure");

    expect(readRow()).toBeDefined();
    await expect(readFile(path, "utf8")).resolves.toBe("hello");
  });
});
