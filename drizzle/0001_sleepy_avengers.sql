PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_upload_metadata` (
	`storage_key` text PRIMARY KEY NOT NULL,
	`id` text NOT NULL,
	`token` text NOT NULL,
	`original_name` text NOT NULL,
	`stored_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`storage_path` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`password_hash` text,
	`download_limit` integer,
	`download_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_upload_metadata`("storage_key", "id", "token", "original_name", "stored_name", "mime_type", "size", "storage_path", "created_at", "expires_at", "password_hash", "download_limit", "download_count") SELECT "id", "id", "token", "original_name", "stored_name", "mime_type", "size", "storage_path", "created_at", "expires_at", "password_hash", "download_limit", "download_count" FROM `upload_metadata`;--> statement-breakpoint
DROP TABLE `upload_metadata`;--> statement-breakpoint
ALTER TABLE `__new_upload_metadata` RENAME TO `upload_metadata`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `upload_metadata_token_unique` ON `upload_metadata` (`token`);--> statement-breakpoint
CREATE INDEX `upload_metadata_id_index` ON `upload_metadata` (`id`);