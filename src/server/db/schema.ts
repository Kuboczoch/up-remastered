import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const uploadMetadata = sqliteTable("upload_metadata", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  originalName: text("original_name").notNull(),
  storedName: text("stored_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  storagePath: text("storage_path").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  passwordHash: text("password_hash"),
  downloadLimit: integer("download_limit"),
  downloadCount: integer("download_count").notNull().default(0),
});

export type UploadMetadata = typeof uploadMetadata.$inferSelect;
export type NewUploadMetadata = typeof uploadMetadata.$inferInsert;
