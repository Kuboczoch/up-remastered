import "server-only";

import { and, eq, gt, sql } from "drizzle-orm";

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

export function hasActiveUploadId(
  db: DbClient,
  id: string,
  now = new Date(),
): boolean {
  const row = db
    .select({ id: uploadMetadata.id })
    .from(uploadMetadata)
    .where(and(eq(uploadMetadata.id, id), gt(uploadMetadata.expiresAt, now)))
    .get();

  return row !== undefined;
}
