import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const uploadMetadata = sqliteTable(
  "upload_metadata",
  {
    storageKey: text("storage_key").primaryKey(),
    id: text("id").notNull(),
    token: text("token").notNull().unique(),
    originalName: text("original_name").notNull(),
    storedName: text("stored_name").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    storagePath: text("storage_path").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("upload_metadata_id_index").on(table.id)],
);

export type UploadMetadata = typeof uploadMetadata.$inferSelect;
export type NewUploadMetadata = typeof uploadMetadata.$inferInsert;
