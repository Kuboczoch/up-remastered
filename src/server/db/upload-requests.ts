import "server-only";

import { and, eq, gt, isNull } from "drizzle-orm";

import type { DbClient } from "@/server/db/client";
import {
  type NewUploadRequest,
  type UploadRequest,
  uploadIdReservations,
  uploadRequests,
} from "@/server/db/schema";

export function insertUploadRequestWithReservation(
  db: DbClient,
  request: NewUploadRequest,
  reservedAt: Date,
): void {
  if (!request.uploadId) {
    throw new Error("Upload requests require a reserved upload ID.");
  }
  const uploadId = request.uploadId;

  db.transaction((tx) => {
    tx.insert(uploadIdReservations)
      .values({ id: uploadId, createdAt: reservedAt })
      .run();
    tx.insert(uploadRequests).values(request).run();
  });
}

export function getUploadRequestByPublicHash(
  db: DbClient,
  publicTokenHash: string,
): UploadRequest | undefined {
  return db
    .select()
    .from(uploadRequests)
    .where(eq(uploadRequests.publicTokenHash, publicTokenHash))
    .get();
}

export function getUploadRequestByManagementHash(
  db: DbClient,
  managementTokenHash: string,
): UploadRequest | undefined {
  return db
    .select()
    .from(uploadRequests)
    .where(eq(uploadRequests.managementTokenHash, managementTokenHash))
    .get();
}

export function claimUploadRequest(
  db: DbClient,
  publicTokenHash: string,
  claimId: string,
  now: Date,
): UploadRequest | undefined {
  return db
    .update(uploadRequests)
    .set({ claimId, claimedAt: now, retryAt: null })
    .where(
      and(
        eq(uploadRequests.publicTokenHash, publicTokenHash),
        gt(uploadRequests.expiresAt, now),
        isNull(uploadRequests.revokedAt),
        isNull(uploadRequests.consumedAt),
        isNull(uploadRequests.claimId),
      ),
    )
    .returning()
    .get();
}

export function releaseUploadRequestClaim(
  db: DbClient,
  publicTokenHash: string,
  claimId: string,
  now: Date,
): boolean {
  const result = db
    .update(uploadRequests)
    .set({ claimId: null, claimedAt: null, retryAt: now })
    .where(
      and(
        eq(uploadRequests.publicTokenHash, publicTokenHash),
        eq(uploadRequests.claimId, claimId),
        isNull(uploadRequests.consumedAt),
      ),
    )
    .run();

  return result.changes === 1;
}

export function consumeUploadRequest(
  db: DbClient,
  publicTokenHash: string,
  claimId: string,
  uploadId: string,
  now: Date,
): boolean {
  const result = db
    .update(uploadRequests)
    .set({ consumedAt: now, uploadId })
    .where(
      and(
        eq(uploadRequests.publicTokenHash, publicTokenHash),
        eq(uploadRequests.claimId, claimId),
        isNull(uploadRequests.consumedAt),
        isNull(uploadRequests.revokedAt),
      ),
    )
    .run();

  return result.changes === 1;
}

export function revokeUploadRequest(
  db: DbClient,
  managementTokenHash: string,
  now: Date,
): UploadRequest | undefined {
  db.update(uploadRequests)
    .set({ revokedAt: now })
    .where(
      and(
        eq(uploadRequests.managementTokenHash, managementTokenHash),
        gt(uploadRequests.expiresAt, now),
        isNull(uploadRequests.revokedAt),
        isNull(uploadRequests.consumedAt),
      ),
    )
    .run();

  return getUploadRequestByManagementHash(db, managementTokenHash);
}
