import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const uploadIdReservations = sqliteTable("upload_id_reservations", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
});

export type NewUploadIdReservation = typeof uploadIdReservations.$inferInsert;

export const uploadMetadata = sqliteTable("upload_metadata", {
  accessTokenHash: text("access_token_hash"),
  id: text("id").primaryKey(),
  originalName: text("original_name").notNull(),
  storedName: text("stored_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  storagePath: text("storage_path").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  cleanupClaimId: text("cleanup_claim_id"),
  cleanupClaimedAt: integer("cleanup_claimed_at", {
    mode: "timestamp_ms",
  }),
});

export type UploadMetadata = typeof uploadMetadata.$inferSelect;
export type NewUploadMetadata = typeof uploadMetadata.$inferInsert;

export const uploadRequests = sqliteTable("upload_requests", {
  publicTokenHash: text("public_token_hash").primaryKey(),
  managementTokenHash: text("management_token_hash").notNull().unique(),
  maxBytes: integer("max_bytes").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  claimId: text("claim_id"),
  claimedAt: integer("claimed_at", { mode: "timestamp_ms" }),
  retryAt: integer("retry_at", { mode: "timestamp_ms" }),
  consumedAt: integer("consumed_at", { mode: "timestamp_ms" }),
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  uploadId: text("upload_id"),
});

export type UploadRequest = typeof uploadRequests.$inferSelect;
export type NewUploadRequest = typeof uploadRequests.$inferInsert;
