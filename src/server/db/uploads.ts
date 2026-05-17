import "server-only";

import { eq, sql } from "drizzle-orm";

import type { DbClient } from "@/server/db/client";
import { type NewUploadMetadata, uploadMetadata } from "@/server/db/schema";

export function getTotalStoredUploadBytes(db: DbClient): number {
  const row = db
    .select({
      totalBytes: sql<number>`coalesce(sum(${uploadMetadata.size}), 0)`,
    })
    .from(uploadMetadata)
    .get();

  return Number(row?.totalBytes ?? 0);
}

export function insertUploadMetadata(
  db: DbClient,
  metadata: NewUploadMetadata,
): void {
  db.insert(uploadMetadata).values(metadata).run();
}

export function insertUploadMetadataWithinQuota(
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
    const totalBytes = Number(row?.totalBytes ?? 0);

    if (totalBytes + metadata.size > maxStoredBytes) {
      return false;
    }

    tx.insert(uploadMetadata).values(metadata).run();

    return true;
  });
}

export function deleteUploadMetadata(db: DbClient, id: string): void {
  db.delete(uploadMetadata).where(eq(uploadMetadata.id, id)).run();
}

export function hasUploadId(db: DbClient, id: string): boolean {
  const row = db
    .select({ id: uploadMetadata.id })
    .from(uploadMetadata)
    .where(eq(uploadMetadata.id, id))
    .get();

  return row !== undefined;
}
