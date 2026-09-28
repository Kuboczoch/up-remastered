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

export function restoreUploadMetadata(
  db: DbClient,
  metadata: NewUploadMetadata,
): void {
  db.insert(uploadMetadata).values(metadata).run();
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
