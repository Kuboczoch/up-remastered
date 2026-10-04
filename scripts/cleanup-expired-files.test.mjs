import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { afterEach, beforeEach, test } from "node:test";

import {
  cleanupExpiredUploads,
  openCleanupDatabase,
} from "./cleanup-expired-files.mjs";

const NOW = new Date("2026-01-02T00:00:00.000Z");
let directory;
let uploads;
let database;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "up-cleanup-"));
  uploads = join(directory, "uploads");
  const { mkdir } = await import("node:fs/promises");
  await mkdir(uploads);
  database = openCleanupDatabase({
    databaseUrl: pathToFileURL(join(directory, "app.db")).href,
    migrationsFolder: resolve("drizzle"),
  });
});

afterEach(async () => {
  database?.close();
  database = undefined;
  await rm(directory, { force: true, recursive: true });
});

function insertUpload({ id, expiresAt, size = 5, storedName = `${id}.bin` }) {
  database
    .prepare(
      `INSERT INTO upload_metadata
       (id, original_name, stored_name, mime_type, size, storage_path,
        created_at, expires_at)
       VALUES (?, ?, ?, 'application/octet-stream', ?, ?, ?, ?)`,
    )
    .run(
      id,
      `${id}.txt`,
      storedName,
      size,
      join(uploads, storedName),
      NOW.getTime() - 86_400_000,
      expiresAt.getTime(),
    );
}

function ids() {
  return database
    .prepare("SELECT id FROM upload_metadata ORDER BY id")
    .all()
    .map(({ id }) => id);
}

test("deletes expired and missing files, preserves live rows, and is idempotent", async () => {
  insertUpload({
    id: "AAAAA",
    expiresAt: new Date(NOW.getTime() - 1),
    size: 7,
  });
  insertUpload({
    id: "BBBBB",
    expiresAt: new Date(NOW.getTime() - 1),
    size: 5,
  });
  insertUpload({
    id: "CCCCC",
    expiresAt: new Date(NOW.getTime() + 1),
    size: 11,
  });
  await writeFile(join(uploads, "AAAAA.bin"), "expired");
  await writeFile(join(uploads, "CCCCC.bin"), "live");

  const first = await cleanupExpiredUploads({
    database,
    uploadDirectory: uploads,
    now: NOW,
  });
  assert.deepEqual(first, {
    examined: 2,
    claimed: 2,
    deleted: 2,
    missing: 1,
    failed: 0,
    freedBytes: 12,
  });
  assert.deepEqual(ids(), ["CCCCC"]);
  assert.equal(
    database.prepare("SELECT sum(size) AS total FROM upload_metadata").get()
      .total,
    11,
  );

  const second = await cleanupExpiredUploads({
    database,
    uploadDirectory: uploads,
    now: NOW,
  });
  assert.equal(second.deleted, 0);
  assert.deepEqual(ids(), ["CCCCC"]);
});

test("reclaims exhausted rows, preserves finite live and unlimited rows", async () => {
  for (const id of ["AAAAA", "BBBBB", "CCCCC"]) {
    insertUpload({ id, expiresAt: new Date(NOW.getTime() + 3600000) });
    await writeFile(join(uploads, `${id}.bin`), "hello");
  }
  database
    .prepare(
      "UPDATE upload_metadata SET max_downloads = 1, download_count = 1 WHERE id = 'AAAAA'",
    )
    .run();
  database
    .prepare(
      "UPDATE upload_metadata SET max_downloads = 2, download_count = 1 WHERE id = 'BBBBB'",
    )
    .run();
  database
    .prepare(
      "UPDATE upload_metadata SET download_count = 100 WHERE id = 'CCCCC'",
    )
    .run();
  const result = await cleanupExpiredUploads({
    database,
    uploadDirectory: uploads,
    now: NOW,
  });
  assert.equal(result.deleted, 1);
  assert.deepEqual(ids(), ["BBBBB", "CCCCC"]);
});

test("releases failed claims for a later retry", async () => {
  insertUpload({ id: "AAAAA", expiresAt: new Date(NOW.getTime() - 1) });
  await writeFile(join(uploads, "AAAAA.bin"), "bytes");
  const denied = Object.assign(new Error("denied"), { code: "EACCES" });

  const failed = await cleanupExpiredUploads({
    database,
    uploadDirectory: uploads,
    now: NOW,
    unlinkFile: async () => {
      throw denied;
    },
  });
  assert.equal(failed.failed, 1);
  assert.deepEqual(ids(), ["AAAAA"]);
  assert.equal(
    database
      .prepare("SELECT cleanup_claim_id AS claim FROM upload_metadata")
      .get().claim,
    null,
  );

  const retried = await cleanupExpiredUploads({
    database,
    uploadDirectory: uploads,
    now: NOW,
  });
  assert.equal(retried.deleted, 1);
  assert.deepEqual(ids(), []);
});

test("allows only one concurrent cleaner to claim a row", async () => {
  insertUpload({ id: "AAAAA", expiresAt: new Date(NOW.getTime() - 1) });
  await writeFile(join(uploads, "AAAAA.bin"), "bytes");
  let releaseUnlink;
  const waiting = new Promise((resolvePromise) => {
    releaseUnlink = resolvePromise;
  });
  let started;
  const unlinkStarted = new Promise((resolvePromise) => {
    started = resolvePromise;
  });

  const firstPromise = cleanupExpiredUploads({
    database,
    uploadDirectory: uploads,
    now: NOW,
    unlinkFile: async (path) => {
      started();
      await waiting;
      const { unlink } = await import("node:fs/promises");
      await unlink(path);
    },
  });
  await unlinkStarted;
  const second = await cleanupExpiredUploads({
    database,
    uploadDirectory: uploads,
    now: NOW,
  });
  assert.equal(second.claimed, 0);
  releaseUnlink();
  const first = await firstPromise;
  assert.equal(first.deleted, 1);
  assert.deepEqual(ids(), []);
});

test("CLI returns nonzero for failures without logging identifiers", () => {
  insertUpload({
    id: "SECRET",
    expiresAt: new Date(NOW.getTime() - 1),
    storedName: "../outside.bin",
  });
  const databaseUrl = pathToFileURL(join(directory, "app.db")).href;
  database.close();
  database = undefined;

  const failed = spawnSync(
    process.execPath,
    [resolve("scripts/cleanup-expired-files.mjs")],
    {
      cwd: resolve("."),
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: databaseUrl, UPLOAD_DIR: uploads },
    },
  );
  assert.equal(failed.status, 1);
  assert.doesNotMatch(failed.stdout + failed.stderr, /SECRET|outside/);
  assert.deepEqual(JSON.parse(failed.stdout.trim()), {
    event: "expired_upload_cleanup_complete",
    examined: 1,
    claimed: 1,
    deleted: 0,
    missing: 0,
    failed: 1,
    freedBytes: 0,
  });

  database = openCleanupDatabase({
    databaseUrl,
    migrationsFolder: resolve("drizzle"),
  });
  database.prepare("DELETE FROM upload_metadata").run();
  database.close();
  database = undefined;
  const successful = spawnSync(
    process.execPath,
    [resolve("scripts/cleanup-expired-files.mjs")],
    {
      cwd: resolve("."),
      encoding: "utf8",
      env: { ...process.env, DATABASE_URL: databaseUrl, UPLOAD_DIR: uploads },
    },
  );
  assert.equal(successful.status, 0);
  assert.equal(JSON.parse(successful.stdout).failed, 0);
});

test("preserves a failed rollback tombstone across failed and concurrent cleanup retries", async () => {
  insertUpload({ id: "AAAAA", expiresAt: new Date(NOW.getTime() - 1) });
  const claimId = "failed-delete";
  const tombstone = join(uploads, `AAAAA.bin.deleting-${claimId}`);
  await writeFile(tombstone, "bytes");
  database
    .prepare(
      "UPDATE upload_metadata SET cleanup_claim_id = ?, cleanup_claimed_at = ?, download_count = 2",
    )
    .run(claimId, NOW.getTime() - 20 * 60 * 1000);
  const failed = await cleanupExpiredUploads({
    database,
    uploadDirectory: uploads,
    now: NOW,
    unlinkFile: async (path) => {
      if (path === tombstone)
        throw Object.assign(new Error("denied"), { code: "EACCES" });
      const { unlink } = await import("node:fs/promises");
      await unlink(path);
    },
  });
  assert.equal(failed.failed, 1);
  assert.equal(failed.deleted, 0);
  assert.equal(failed.freedBytes, 0);
  assert.equal(failed.missing, 0);
  const row = database
    .prepare(
      "SELECT cleanup_claim_id AS claim, download_count AS count, size FROM upload_metadata",
    )
    .get();
  assert.deepEqual(row, { claim: claimId, count: 2, size: 5 });
  const { readFile, access, unlink } = await import("node:fs/promises");
  assert.equal(await readFile(tombstone, "utf8"), "bytes");
  let started;
  const ready = new Promise((resolvePromise) => {
    started = resolvePromise;
  });
  let proceed;
  const waiting = new Promise((resolvePromise) => {
    proceed = resolvePromise;
  });
  const later = new Date(NOW.getTime() + 20 * 60 * 1000);
  const first = cleanupExpiredUploads({
    database,
    uploadDirectory: uploads,
    now: later,
    unlinkFile: async (path) => {
      if (path === tombstone) {
        started();
        await waiting;
      }
      await unlink(path);
    },
  });
  await ready;
  const concurrent = await cleanupExpiredUploads({
    database,
    uploadDirectory: uploads,
    now: later,
  });
  assert.equal(concurrent.claimed, 0);
  proceed();
  const recovered = await first;
  assert.equal(recovered.deleted, 1);
  assert.equal(recovered.freedBytes, 5);
  assert.equal(recovered.missing, 0);
  assert.deepEqual(ids(), []);
  await assert.rejects(access(tombstone), { code: "ENOENT" });
});

test("keeps the fence if metadata deletion fails after bytes are reclaimed", async () => {
  insertUpload({ id: "AAAAA", expiresAt: new Date(NOW.getTime() - 1) });
  await writeFile(join(uploads, "AAAAA.bin"), "bytes");
  database.exec(`CREATE TRIGGER deny_cleanup BEFORE DELETE ON upload_metadata
    BEGIN SELECT RAISE(FAIL, 'blocked metadata deletion'); END`);
  const failed = await cleanupExpiredUploads({
    database,
    uploadDirectory: uploads,
    now: NOW,
    createClaimId: () => "db-failure",
  });
  assert.equal(failed.failed, 1);
  assert.equal(failed.deleted, 0);
  assert.equal(failed.freedBytes, 0);
  assert.equal(
    database
      .prepare("SELECT cleanup_claim_id AS claim FROM upload_metadata")
      .get().claim,
    "db-failure",
  );
  database.exec("DROP TRIGGER deny_cleanup");
  const retried = await cleanupExpiredUploads({
    database,
    uploadDirectory: uploads,
    now: new Date(NOW.getTime() + 20 * 60 * 1000),
  });
  assert.equal(retried.deleted, 1);
  assert.equal(retried.freedBytes, 5);
  assert.equal(retried.missing, 1);
  assert.deepEqual(ids(), []);
});

test("reclaims both original and tombstone before deleting metadata", async () => {
  insertUpload({ id: "AAAAA", expiresAt: new Date(NOW.getTime() - 1) });
  await writeFile(join(uploads, "AAAAA.bin"), "bytes");
  const tombstone = join(uploads, "AAAAA.bin.deleting-old-delete");
  await writeFile(tombstone, "bytes");
  database
    .prepare(
      "UPDATE upload_metadata SET cleanup_claim_id = ?, cleanup_claimed_at = ?",
    )
    .run("old-delete", NOW.getTime() - 20 * 60 * 1000);
  const { access, unlink } = await import("node:fs/promises");
  const failed = await cleanupExpiredUploads({
    database,
    uploadDirectory: uploads,
    now: NOW,
    unlinkFile: async (path) => {
      if (path === join(uploads, "AAAAA.bin"))
        throw new Error("original locked");
      await unlink(path);
    },
  });
  assert.equal(failed.failed, 1);
  assert.equal(failed.freedBytes, 0);
  assert.deepEqual(ids(), ["AAAAA"]);
  assert.equal(
    database
      .prepare("SELECT cleanup_claim_id AS claim FROM upload_metadata")
      .get().claim,
    "old-delete",
  );
  await assert.rejects(access(tombstone), { code: "ENOENT" });
  await access(join(uploads, "AAAAA.bin"));
  const recovered = await cleanupExpiredUploads({
    database,
    uploadDirectory: uploads,
    now: new Date(NOW.getTime() + 20 * 60 * 1000),
  });
  assert.equal(recovered.deleted, 1);
  assert.equal(recovered.freedBytes, 5);
  assert.equal(recovered.missing, 0);
  await assert.rejects(access(join(uploads, "AAAAA.bin")), { code: "ENOENT" });
  assert.deepEqual(ids(), []);
});

test("recovers a stale lease after a crashed cleaner", async () => {
  insertUpload({ id: "AAAAA", expiresAt: new Date(NOW.getTime() - 1) });
  database
    .prepare(
      "UPDATE upload_metadata SET cleanup_claim_id = 'dead', cleanup_claimed_at = ? WHERE id = 'AAAAA'",
    )
    .run(NOW.getTime() - 20 * 60 * 1000);

  const summary = await cleanupExpiredUploads({
    database,
    uploadDirectory: uploads,
    now: NOW,
  });
  assert.equal(summary.missing, 1);
  assert.deepEqual(ids(), []);
});
