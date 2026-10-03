import { afterEach, beforeEach, describe, expect, it } from "@jest/globals";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDbClient, createSqliteConnection } from "@/server/db/client";
import { migrateDatabase } from "@/server/db/migrate";
import { uploadMetadata } from "@/server/db/schema";
import { getUploadMetadata } from "@/server/db/uploads";
import { createDownloadResponse } from "@/server/downloads/create-download-response";
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
  it("hides exhausted uploads from public metadata without consuming download slots", () => {
    insertUpload();
    const connection = createSqliteConnection();
    try {
      connection
        .prepare(
          "UPDATE upload_metadata SET max_downloads = 1 WHERE id = 'A7K2Q'",
        )
        .run();
      expect(getPublicUploadDetails("A7K2Q", NOW)).toMatchObject({
        maxDownloads: 1,
        encrypted: false,
      });
      expect(readRow()?.downloadCount).toBe(0);
      connection
        .prepare(
          "UPDATE upload_metadata SET download_count = 1 WHERE id = 'A7K2Q'",
        )
        .run();
      expect(getPublicUploadDetails("A7K2Q", NOW)).toBeUndefined();
    } finally {
      connection.close();
    }
  });
  it("returns public details without exposing the access token hash", () => {
    insertUpload();

    expect(getPublicUploadDetails("A7K2Q", NOW)).toEqual({
      expirationDate: "2026-01-02T00:00:00.000Z",
      encrypted: false,
      maxDownloads: null,
      key: "A7K2Q",
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

  it("blocks concurrent GETs during owner deletion and preserves admitted downloads on EACCES rollback", async () => {
    insertUpload();
    const connection = createSqliteConnection();
    try {
      connection
        .prepare(
          "UPDATE upload_metadata SET max_downloads = 2 WHERE id = 'A7K2Q'",
        )
        .run();
    } finally {
      connection.close();
    }
    const path = join(process.env.UPLOAD_DIR!, "A7K2Q.bin");
    await writeFile(path, "hello");
    const admitted = await createDownloadResponse("A7K2Q", null, NOW);
    expect(admitted.status).toBe(200);
    expect(await admitted.text()).toBe("hello");
    let concurrentStatus = 0;
    let admittedCount = 1;
    const failure = Object.assign(new Error("simulated EACCES"), {
      code: "EACCES",
    });

    await expect(
      deleteUploadWithAccessToken("A7K2Q", TOKEN, NOW, {
        rename: async (source, destination) => {
          // Pause before the real rename: the original path still exists,
          // so only the database claim can reject the concurrent GET.
          if (source === path) {
            const concurrent = await createDownloadResponse("A7K2Q", null, NOW);
            concurrentStatus = concurrent.status;
            await concurrent.text();
            if (concurrent.status === 200) admittedCount++;
          }
          await rename(source, destination);
        },
        unlink: async () => {
          throw failure;
        },
      }),
    ).rejects.toBe(failure);

    // An admitted GET must never be refunded by restoring a stale snapshot.
    expect(readRow()?.downloadCount).toBe(admittedCount);
    expect(concurrentStatus).toBe(404);
    expect(readRow()?.cleanupClaimId).toBeNull();
    await expect(readFile(path, "utf8")).resolves.toBe("hello");
    const afterRollback = await createDownloadResponse("A7K2Q", null, NOW);
    expect(afterRollback.status).toBe(200);
    expect(await afterRollback.text()).toBe("hello");
    expect(readRow()?.downloadCount).toBe(admittedCount + 1);
    expect((await createDownloadResponse("A7K2Q", null, NOW)).status).toBe(404);
    expect(readRow()?.downloadCount).toBe(2);
  });

  it("rejects a second owner deletion while the first owns the claim", async () => {
    insertUpload();
    const path = join(process.env.UPLOAD_DIR!, "A7K2Q.bin");
    await writeFile(path, "hello");
    const competingRename = jest.fn(rename);
    let competingResult: string | undefined;
    await expect(
      deleteUploadWithAccessToken("A7K2Q", TOKEN, NOW, {
        rename: async (source, destination) => {
          competingResult = await deleteUploadWithAccessToken(
            "A7K2Q",
            TOKEN,
            NOW,
            {
              rename: competingRename,
              unlink,
            },
          );
          await rename(source, destination);
        },
        unlink,
      }),
    ).resolves.toBe("valid");
    expect(competingResult).toBe("not-found");
    expect(competingRename).not.toHaveBeenCalled();
    expect(readRow()).toBeUndefined();
  });

  it("releases the deletion claim when the initial rename fails", async () => {
    insertUpload();
    const path = join(process.env.UPLOAD_DIR!, "A7K2Q.bin");
    await writeFile(path, "hello");
    const failure = Object.assign(new Error("simulated EACCES"), {
      code: "EACCES",
    });
    const remove = jest.fn(unlink);
    await expect(
      deleteUploadWithAccessToken("A7K2Q", TOKEN, NOW, {
        rename: async () => {
          throw failure;
        },
        unlink: remove,
      }),
    ).rejects.toBe(failure);
    expect(remove).not.toHaveBeenCalled();
    expect(readRow()?.cleanupClaimId).toBeNull();
    const response = await createDownloadResponse("A7K2Q", null, NOW);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("hello");
    expect(readRow()?.downloadCount).toBe(1);
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
