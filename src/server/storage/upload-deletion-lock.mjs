import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { mkdirSync, realpathSync } from "node:fs";
import { resolve } from "node:path";

// Fixed shards bound the number of permanent lock files while allowing unrelated
// deletions to proceed concurrently. Never unlink these files: replacing a lock
// inode while another process owns it would create two independent owners.
export function tryAcquireUploadDeletionLock(database, id) {
  const directory = `${realpathSync(database.name)}.deletion-locks`;
  mkdirSync(directory, { recursive: true });
  const shard = createHash("sha256").update(id).digest()[0] % 64;
  const lock = new Database(resolve(directory, `${shard}.sqlite`));
  // Blocking SQLite busy waits would prevent an async owner in this same process
  // from resuming. Contenders must skip (cleanup) or yield and retry (management).
  lock.pragma("busy_timeout = 0");
  try {
    lock.exec("BEGIN IMMEDIATE");
  } catch (error) {
    lock.close();
    if (error.code === "SQLITE_BUSY") return undefined;
    throw error;
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    try {
      lock.exec("ROLLBACK");
    } finally {
      lock.close();
    }
  };
}
