import "server-only";

import { eq, sql } from "drizzle-orm";

import type { DbClient } from "@/server/db/client";
import {
  type NewUploadMetadata,
  type UploadMetadata,
  uploadIdReservations,
  uploadMetadata,
} from "@/server/db/schema";

export function getTotalStoredUploadBytes(db: DbClient): number {
  const row = db
    .select({
      totalBytes: sql<number>`coalesce(sum(${uploadMetadata.size}), 0)`,
    })
    .from(uploadMetadata)
    .get();

  return Number(row?.totalBytes ?? 0);
}

export function insertNewUploadMetadataWithinQuota(
  db: DbClient,
  metadata: NewUploadMetadata,
  maxStoredBytes: number,
): boolean {
  return db.transaction((tx) => {
    const row = tx
      .select({
        totalBytes: sql<number>`coalesce(sum(${uploadMetadata.size}), 0)`,
      })
      .from(uploadMetadata)
      .get();

    if (Number(row?.totalBytes ?? 0) + metadata.size > maxStoredBytes) {
      return false;
    }

    tx.insert(uploadIdReservations)
      .values({ id: metadata.id, createdAt: metadata.createdAt })
      .run();
    tx.insert(uploadMetadata).values(metadata).run();

    return true;
  });
}

export function insertReservedUploadMetadataWithinQuota(
  db: DbClient,
  metadata: NewUploadMetadata,
  maxStoredBytes: number,
): boolean {
  return db.transaction((tx) => {
    const row = tx
      .select({
        totalBytes: sql<number>`coalesce(sum(${uploadMetadata.size}), 0)`,
      })
      .from(uploadMetadata)
      .get();

    if (Number(row?.totalBytes ?? 0) + metadata.size > maxStoredBytes) {
      return false;
    }

    const reservation = tx
      .select({ id: uploadIdReservations.id })
      .from(uploadIdReservations)
      .where(eq(uploadIdReservations.id, metadata.id))
      .get();

    if (!reservation) {
      throw new Error(`Upload ID ${metadata.id} is not reserved.`);
    }

    tx.insert(uploadMetadata).values(metadata).run();
    return true;
  });
}

// Shares the download admission predicate; SQLite serializes both writes.
export function claimUploadOwnerDeletion(
  db: DbClient,
  id: string,
  accessTokenHash: string,
  claimId: string,
  now: Date,
): boolean {
  return (
    db
      .update(uploadMetadata)
      .set({ cleanupClaimId: claimId, cleanupClaimedAt: now })
      .where(
        sql`${uploadMetadata.id} = ${id}
      AND ${uploadMetadata.accessTokenHash} = ${accessTokenHash}
      AND ${uploadMetadata.expiresAt} > ${now.getTime()}
      AND ${uploadMetadata.cleanupClaimId} IS NULL
      AND (${uploadMetadata.maxDownloads} IS NULL OR ${uploadMetadata.downloadCount} < ${uploadMetadata.maxDownloads})`,
      )
      .run().changes === 1
  );
}

export function releaseUploadOwnerDeletion(
  db: DbClient,
  id: string,
  claimId: string,
): void {
  db.update(uploadMetadata)
    .set({ cleanupClaimId: null, cleanupClaimedAt: null })
    .where(
      sql`${uploadMetadata.id} = ${id} AND ${uploadMetadata.cleanupClaimId} = ${claimId}`,
    )
    .run();
}

export function completeUploadOwnerDeletion(
  db: DbClient,
  id: string,
  claimId: string,
): void {
  db.delete(uploadMetadata)
    .where(
      sql`${uploadMetadata.id} = ${id} AND ${uploadMetadata.cleanupClaimId} = ${claimId}`,
    )
    .run();
}

export function deleteUploadMetadata(db: DbClient, id: string): void {
  db.delete(uploadMetadata).where(eq(uploadMetadata.id, id)).run();
}

export function hasUploadId(db: DbClient, id: string): boolean {
  const row = db
    .select({ id: uploadIdReservations.id })
    .from(uploadIdReservations)
    .where(eq(uploadIdReservations.id, id))
    .get();

  return row !== undefined;
}

/* The predicate and increment are one SQLite write across connections/processes. */
export function claimUploadDownload(
  db: DbClient,
  id: string,
  now: Date,
): boolean {
  const result = db
    .update(uploadMetadata)
    .set({ downloadCount: sql`${uploadMetadata.downloadCount} + 1` })
    .where(
      sql`${uploadMetadata.id} = ${id}
      AND ${uploadMetadata.expiresAt} > ${now.getTime()}
      AND ${uploadMetadata.cleanupClaimId} IS NULL
      AND (${uploadMetadata.maxDownloads} IS NULL OR ${uploadMetadata.downloadCount} < ${uploadMetadata.maxDownloads})`,
    )
    .run();
  return result.changes === 1;
}

export function getUploadMetadata(
  db: DbClient,
  id: string,
): UploadMetadata | undefined {
  return db
    .select()
    .from(uploadMetadata)
    .where(eq(uploadMetadata.id, id))
    .get();
}
