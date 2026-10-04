import Database from "better-sqlite3";
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { basename, dirname, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { tryAcquireUploadDeletionLock } from "../src/server/storage/upload-deletion-lock.mjs";

const DEFAULT_LEASE_MS = 10 * 60 * 1000;

function isMissingFileError(error) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function resolveDatabasePath(databaseUrl) {
  const value = databaseUrl.trim();
  if (!value.startsWith("file:")) {
    throw new Error("DATABASE_URL must be a file: SQLite URL.");
  }
  if (value.startsWith("file:./") || value.startsWith("file:../")) {
    return resolve(value.slice(5));
  }
  return fileURLToPath(new URL(value));
}

function resolveUploadPath(uploadDirectory, storedName) {
  if (basename(storedName) !== storedName) {
    throw new Error("Stored upload name must not contain a path.");
  }
  const directory = resolve(uploadDirectory);
  const path = resolve(directory, storedName);
  if (path !== directory && !path.startsWith(`${directory}${sep}`)) {
    throw new Error("Stored upload path escapes UPLOAD_DIR.");
  }
  return path;
}

export function openCleanupDatabase({ databaseUrl, migrationsFolder }) {
  const databasePath = resolveDatabasePath(databaseUrl);
  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new Database(databasePath);
  database.pragma("busy_timeout = 5000");
  database.pragma("foreign_keys = ON");
  applyMigrations(database, migrationsFolder);
  return database;
}

export function applyMigrations(database, migrationsFolder) {
  const journal = JSON.parse(
    readFileSync(resolve(migrationsFolder, "meta/_journal.json"), "utf8"),
  );
  database.exec(
    `CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at numeric
    )`,
  );
  const latest = database
    .prepare(
      "SELECT created_at AS createdAt FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1",
    )
    .get();
  const latestCreatedAt = Number(latest?.createdAt ?? 0);

  for (const entry of journal.entries) {
    if (Number(entry.when) <= latestCreatedAt) continue;
    const sql = readFileSync(
      resolve(migrationsFolder, `${entry.tag}.sql`),
      "utf8",
    );
    const hash = createHash("sha256").update(sql).digest("hex");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    database.transaction(() => {
      for (const statement of statements) database.exec(statement);
      database
        .prepare(
          "INSERT INTO __drizzle_migrations (hash, created_at) VALUES (?, ?)",
        )
        .run(hash, Number(entry.when));
    })();
  }
}

export async function cleanupExpiredUploads({
  database,
  uploadDirectory,
  now = new Date(),
  leaseMs = DEFAULT_LEASE_MS,
  createClaimId = randomUUID,
  unlinkFile = unlink,
}) {
  const nowMs = now.getTime();
  const staleBeforeMs = nowMs - leaseMs;
  const candidates = database
    .prepare(
      `SELECT id, stored_name AS storedName, size,
              cleanup_claim_id AS claimId, cleanup_claimed_at AS claimedAt
       FROM upload_metadata
       WHERE (expires_at <= ? OR (max_downloads IS NOT NULL AND download_count >= max_downloads))
         AND (cleanup_claim_id IS NULL OR cleanup_claimed_at <= ?)
       ORDER BY id`,
    )
    .all(nowMs, staleBeforeMs);
  const summary = {
    examined: candidates.length,
    claimed: 0,
    deleted: 0,
    missing: 0,
    failed: 0,
    freedBytes: 0,
  };

  const claim = database.prepare(
    `UPDATE upload_metadata
     SET cleanup_claim_id = ?, cleanup_claimed_at = ?
     WHERE id = ? AND (expires_at <= ? OR (max_downloads IS NOT NULL AND download_count >= max_downloads))
       AND (cleanup_claim_id IS NULL OR cleanup_claimed_at <= ?)
       AND cleanup_claim_id IS ? AND cleanup_claimed_at IS ?`,
  );
  const release = database.prepare(
    `UPDATE upload_metadata
     SET cleanup_claim_id = NULL, cleanup_claimed_at = NULL
     WHERE id = ? AND cleanup_claim_id = ? AND cleanup_claimed_at = ?`,
  );
  const remove = database.prepare(
    `DELETE FROM upload_metadata WHERE id = ? AND cleanup_claim_id = ? AND cleanup_claimed_at = ?`,
  );

  for (const candidate of candidates) {
    const releaseLock = tryAcquireUploadDeletionLock(database, candidate.id);
    // A stale lease is not permission to race an owner still moving bytes.
    if (!releaseLock) continue;
    try {
      // A stale claim is also the durable suffix identifying a delete tombstone.
      // Renew its lease without replacing that identity.
      const recovering = candidate.claimId !== null;
      const claimId = candidate.claimId ?? createClaimId();
      const claimed = claim.run(
        claimId,
        nowMs,
        candidate.id,
        nowMs,
        staleBeforeMs,
        candidate.claimId,
        candidate.claimedAt,
      );
      if (claimed.changes !== 1) continue;
      summary.claimed += 1;

      const releaseClaim = () => {
        // A recovery failure must remain fenced with the same tombstone suffix.
        if (!recovering) release.run(candidate.id, claimId, nowMs);
      };
      let missing = true;
      try {
        const paths = [
          resolveUploadPath(uploadDirectory, candidate.storedName),
        ];
        if (recovering) {
          paths.unshift(
            resolveUploadPath(
              uploadDirectory,
              `${candidate.storedName}.deleting-${claimId}`,
            ),
          );
        }
        // Both possible locations must be reclaimed before releasing quota.
        for (const path of paths) {
          try {
            await unlinkFile(path);
            missing = false;
          } catch (error) {
            if (!isMissingFileError(error)) throw error;
          }
        }
      } catch {
        releaseClaim();
        summary.failed += 1;
        continue;
      }

      try {
        const removed = remove.run(candidate.id, claimId, nowMs);
        if (removed.changes !== 1) {
          // Bytes are already gone: retain the fence for a later DB-only retry.
          summary.failed += 1;
          continue;
        }
        summary.deleted += 1;
        summary.freedBytes += Number(candidate.size);
        if (missing) summary.missing += 1;
      } catch {
        // Never release a claim after reclaiming its bytes but failing metadata
        // deletion; the next stale-lease pass can safely finish the DB mutation.
        summary.failed += 1;
      }
    } finally {
      releaseLock();
    }
  }

  return summary;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  const uploadDirectory = process.env.UPLOAD_DIR?.trim();
  if (!databaseUrl || !uploadDirectory) {
    throw new Error("DATABASE_URL and UPLOAD_DIR are required.");
  }

  const database = openCleanupDatabase({
    databaseUrl,
    migrationsFolder: resolve(process.cwd(), "drizzle"),
  });
  try {
    const summary = await cleanupExpiredUploads({ database, uploadDirectory });
    console.log(
      JSON.stringify({ event: "expired_upload_cleanup_complete", ...summary }),
    );
    if (summary.failed > 0) process.exitCode = 1;
  } finally {
    database.close();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch(() => {
    console.error(
      JSON.stringify({
        error_code: "cleanup_unavailable",
        event: "expired_upload_cleanup_failed",
      }),
    );
    process.exitCode = 1;
  });
}
