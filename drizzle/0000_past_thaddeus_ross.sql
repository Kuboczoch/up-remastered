CREATE TABLE `upload_metadata` (
	`id` text PRIMARY KEY NOT NULL,
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
CREATE UNIQUE INDEX `upload_metadata_token_unique` ON `upload_metadata` (`token`);