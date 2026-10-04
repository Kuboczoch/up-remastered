import "server-only";

import { randomUUID } from "node:crypto";
import { rename, unlink } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { tryAcquireUploadDeletionLock } from "@/server/storage/upload-deletion-lock.mjs";

import { createDbClient, createSqliteConnection } from "@/server/db/client";
import { ensureDatabaseMigrated } from "@/server/db/migrate";
import type { UploadMetadata } from "@/server/db/schema";
import {
  claimUploadDeletion,
  finishUploadDeletion,
  getUploadMetadata,
  isUploadAvailable,
  releaseUploadDeletion,
} from "@/server/db/uploads";
import { resolveStoredUploadPath } from "@/server/storage/uploads";
import { matchesUploadAccessToken } from "@/server/uploads/access-token";
import { isPublicUploadId } from "@/server/uploads/public-id";

export type UploadAccessResult = "forbidden" | "not-found" | "valid";

export type PublicUploadDetails = {
  expirationDate: string;
  key: string;
  maxDownloads: number | null;
  name: string;
  permanent: false;
  size: number;
  type: string;
};

function getAvailableUpload(id: string, now: Date): UploadMetadata | undefined {
  if (!isPublicUploadId(id)) {
    return undefined;
  }

  ensureDatabaseMigrated();
  const connection = createSqliteConnection();

  try {
    const upload = getUploadMetadata(createDbClient(connection), id);
    return upload && isUploadAvailable(upload, now) ? upload : undefined;
  } finally {
    connection.close();
  }
}

function hasValidToken(upload: UploadMetadata, token: string): boolean {
  return Boolean(
    upload.accessTokenHash &&
    matchesUploadAccessToken(token, upload.accessTokenHash),
  );
}

export function getPublicUploadDetails(
  id: string,
  now = new Date(),
): PublicUploadDetails | undefined {
  const upload = getAvailableUpload(id, now);

  return upload
    ? {
        expirationDate: upload.expiresAt.toISOString(),
        key: upload.id,
        maxDownloads: upload.maxDownloads,
        name: upload.originalName,
        permanent: false,
        size: upload.size,
        type: upload.mimeType,
      }
    : undefined;
}

export function verifyUploadAccess(
  id: string,
  token: string,
  now = new Date(),
): UploadAccessResult {
  const upload = getAvailableUpload(id, now);

  if (!upload) {
    return "not-found";
  }

  return hasValidToken(upload, token) ? "valid" : "forbidden";
}

type DeleteFileOperations = {
  rename: typeof rename;
  unlink: typeof unlink;
};

const defaultFileOperations: DeleteFileOperations = { rename, unlink };

export async function deleteUploadWithAccessToken(
  id: string,
  token: string,
  now = new Date(),
  fileOperations: DeleteFileOperations = defaultFileOperations,
): Promise<UploadAccessResult> {
  const upload = getAvailableUpload(id, now);

  if (!upload) {
    return "not-found";
  }

  if (!hasValidToken(upload, token)) {
    return "forbidden";
  }

  let storagePath: string;

  try {
    storagePath = resolveStoredUploadPath(upload.storedName);
  } catch {
    return "not-found";
  }

  const claimId = randomUUID();
  const tombstonePath = `${storagePath}.deleting-${claimId}`;
  const connection = createSqliteConnection();
  const db = createDbClient(connection);
  let renamed = false;
  let unlinked = false;
  let releaseLock: (() => void) | undefined;

  try {
    // The lock covers claim, every filesystem operation (including rollback),
    // and final metadata mutation. A lease may age but cannot be taken over
    // while this worker can still move bytes. The separate lock DB leaves
    // ordinary metadata writes/download admission free to run during awaits.
    while (!(releaseLock = tryAcquireUploadDeletionLock(connection, id))) {
      const current = getUploadMetadata(db, id);
      if (!current || !isUploadAvailable(current, now)) return "not-found";
      await delay(10);
    }
    if (!claimUploadDeletion(db, id, claimId, now)) return "not-found";
    try {
      await fileOperations.rename(storagePath, tombstonePath);
      renamed = true;
      await fileOperations.unlink(tombstonePath);
      unlinked = true;
      finishUploadDeletion(db, id, claimId, now);
    } catch (error) {
      if (renamed && !unlinked) {
        // Retry one transient restore failure, but never clear the durable
        // tombstone identity or expose the upload until its bytes are restored.
        try {
          await fileOperations.rename(tombstonePath, storagePath);
        } catch (restoreError) {
          try {
            await fileOperations.rename(tombstonePath, storagePath);
          } catch (retryError) {
            throw new AggregateError(
              [error, restoreError, retryError],
              "Upload deletion failed and its tombstone could not be restored.",
            );
          }
        }
      }
      if (!unlinked) releaseUploadDeletion(db, id, claimId, now);
      if (isMissingFileError(error) && !renamed) return "not-found";
      throw error;
    }
  } finally {
    releaseLock?.();
    connection.close();
  }

  return "valid";
}

function isMissingFileError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
