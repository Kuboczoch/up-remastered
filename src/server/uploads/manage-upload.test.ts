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
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDbClient, createSqliteConnection } from "@/server/db/client";
import { migrateDatabase } from "@/server/db/migrate";
import { uploadMetadata } from "@/server/db/schema";
import { createDownloadResponse } from "@/server/downloads/create-download-response";
import {
  getUploadMetadata,
  finishUploadDeletion,
  releaseUploadDeletion,
} from "@/server/db/uploads";
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

async function runExpiredCleanup() {
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import { cleanupExpiredUploads, openCleanupDatabase } from './scripts/cleanup-expired-files.mjs';
     const database = openCleanupDatabase({ databaseUrl: process.env.DATABASE_URL, migrationsFolder: './drizzle' });
     try { console.log(JSON.stringify(await cleanupExpiredUploads({ database, uploadDirectory: process.env.UPLOAD_DIR, now: new Date('2026-01-03T00:00:00Z') }))); }
     finally { database.close(); }`,
    ],
    { env: process.env },
  );
  let output = "";
  let errors = "";
  child.stdout.on("data", (chunk) => {
    output += chunk;
  });
  child.stderr.on("data", (chunk) => {
    errors += chunk;
  });
  await new Promise<void>((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(errors)),
    );
  });
  return JSON.parse(output);
}

describe("upload management", () => {
  it("fences old management release and finish after same-identity lease renewal", () => {
    insertUpload();
    const connection = createSqliteConnection();
    const db = createDbClient(connection);
    const renewedAt = new Date(NOW.getTime() + 60_000);
    try {
      connection
        .prepare(
          "UPDATE upload_metadata SET cleanup_claim_id = ?, cleanup_claimed_at = ? WHERE id = ?",
        )
        .run("durable-identity", renewedAt.getTime(), "A7K2Q");
      releaseUploadDeletion(db, "A7K2Q", "durable-identity", NOW);
      expect(getUploadMetadata(db, "A7K2Q")?.cleanupClaimedAt).toEqual(
        renewedAt,
      );
      expect(() =>
        finishUploadDeletion(db, "A7K2Q", "durable-identity", NOW),
      ).toThrow("claim was lost");
      expect(getUploadMetadata(db, "A7K2Q")?.size).toBe(5);
      finishUploadDeletion(db, "A7K2Q", "durable-identity", renewedAt);
      expect(getUploadMetadata(db, "A7K2Q")).toBeUndefined();
    } finally {
      connection.close();
    }
  });
  it.each(["initial rename", "rollback restore"])(
    "excludes stale takeover during a late %s",
    async (phase) => {
      insertUpload();
      const path = join(process.env.UPLOAD_DIR!, "A7K2Q.bin");
      await writeFile(path, "hello");
      let takeover: Awaited<ReturnType<typeof runExpiredCleanup>>;
      let renames = 0;
      await expect(
        deleteUploadWithAccessToken("A7K2Q", TOKEN, NOW, {
          rename: async (from, to) => {
            renames += 1;
            if (
              (phase === "initial rename" && renames === 1) ||
              (phase === "rollback restore" && renames === 2)
            ) {
              takeover = await runExpiredCleanup();
            }
            if (phase === "initial rename" && renames > 1)
              throw new Error("persistent restore failure");
            await rename(from, to);
          },
          unlink: async () => {
            throw new Error("failed unlink");
          },
        }),
      ).rejects.toThrow();
      expect(takeover!).toMatchObject({
        claimed: 0,
        deleted: 0,
        freedBytes: 0,
      });
      expect(readRow()).toMatchObject({ size: 5, downloadCount: 0 });
      const claim = readRow()?.cleanupClaimId;
      const remainingPath =
        phase === "initial rename" ? `${path}.deleting-${claim}` : path;
      expect(await readFile(remainingPath, "utf8")).toBe("hello");
      expect(await runExpiredCleanup()).toMatchObject({
        deleted: 1,
        freedBytes: 5,
        failed: 0,
      });
      expect(readRow()).toBeUndefined();
      await expect(access(path)).rejects.toMatchObject({ code: "ENOENT" });
      await expect(access(remainingPath)).rejects.toMatchObject({
        code: "ENOENT",
      });
    },
  );
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
  it("retries a transient rollback rename without resetting concurrent counters", async () => {
    insertUpload();
    const path = join(process.env.UPLOAD_DIR!, "A7K2Q.bin");
    await writeFile(path, "hello");
    const connection = createSqliteConnection();
    connection.prepare("UPDATE upload_metadata SET max_downloads = 2").run();
    connection.close();
    const admitted = await createDownloadResponse("A7K2Q", null, NOW);
    expect(await admitted.text()).toBe("hello");
    let renames = 0;
    await expect(
      deleteUploadWithAccessToken("A7K2Q", TOKEN, NOW, {
        rename: async (from, to) => {
          renames += 1;
          expect(
            (await createDownloadResponse("A7K2Q", null, NOW)).status,
          ).toBe(404);
          expect(await deleteUploadWithAccessToken("A7K2Q", TOKEN, NOW)).toBe(
            "not-found",
          );
          if (renames === 2) throw new Error("transient restore failure");
          await rename(from, to);
        },
        unlink: async () => {
          throw new Error("failed unlink");
        },
      }),
    ).rejects.toThrow("failed unlink");
    expect(renames).toBe(3);
    expect(readRow()).toMatchObject({ downloadCount: 1, cleanupClaimId: null });
    expect(await readFile(path, "utf8")).toBe("hello");
    const retry = await createDownloadResponse("A7K2Q", null, NOW);
    expect(await retry.text()).toBe("hello");
    expect(readRow()?.downloadCount).toBe(2);
    expect((await createDownloadResponse("A7K2Q", null, NOW)).status).toBe(404);
    expect(verifyUploadAccess("A7K2Q", TOKEN, NOW)).toBe("not-found");
  });

  it("keeps persistent rollback failures fenced with the actual tombstone identity", async () => {
    insertUpload();
    const path = join(process.env.UPLOAD_DIR!, "A7K2Q.bin");
    await writeFile(path, "hello");
    let renames = 0;
    await expect(
      deleteUploadWithAccessToken("A7K2Q", TOKEN, NOW, {
        rename: async (from, to) => {
          renames += 1;
          if (renames > 1) throw new Error("persistent restore failure");
          await rename(from, to);
        },
        unlink: async () => {
          throw new Error("failed unlink");
        },
      }),
    ).rejects.toThrow();
    const claim = readRow()?.cleanupClaimId;
    expect(claim).toBeTruthy();
    expect(readRow()).toMatchObject({ downloadCount: 0, size: 5 });
    expect(await readFile(`${path}.deleting-${claim}`, "utf8")).toBe("hello");
    await expect(access(path)).rejects.toMatchObject({ code: "ENOENT" });
    expect((await createDownloadResponse("A7K2Q", null, NOW)).status).toBe(404);
    expect(await deleteUploadWithAccessToken("A7K2Q", TOKEN, NOW)).toBe(
      "not-found",
    );
    const cleanup = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { cleanupExpiredUploads, openCleanupDatabase } from './scripts/cleanup-expired-files.mjs';
       const database = openCleanupDatabase({ databaseUrl: process.env.DATABASE_URL, migrationsFolder: './drizzle' });
       try {
         console.log(JSON.stringify(await cleanupExpiredUploads({ database, uploadDirectory: process.env.UPLOAD_DIR, now: new Date('2026-01-03T00:00:00Z') })));
       } finally { database.close(); }`,
      ],
      { encoding: "utf8", env: process.env },
    );
    expect(cleanup.status).toBe(0);
    expect(JSON.parse(cleanup.stdout)).toMatchObject({
      deleted: 1,
      failed: 0,
      missing: 0,
      freedBytes: 5,
    });
    expect(readRow()).toBeUndefined();
    await expect(access(`${path}.deleting-${claim}`)).rejects.toMatchObject({
      code: "ENOENT",
    });
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
