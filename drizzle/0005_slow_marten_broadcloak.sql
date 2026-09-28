CREATE TABLE `upload_id_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `upload_id_reservations` (`id`, `created_at`)
SELECT `id`, `created_at` FROM `upload_metadata`;--> statement-breakpoint
INSERT OR IGNORE INTO `upload_id_reservations` (`id`, `created_at`)
SELECT `upload_id`, `created_at` FROM `upload_requests`
WHERE `upload_id` IS NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_upload_requests` (
	`public_token_hash` text PRIMARY KEY NOT NULL,
	`management_token_hash` text NOT NULL,
	`max_bytes` integer NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`claim_id` text,
	`claimed_at` integer,
	`consumed_at` integer,
	`revoked_at` integer,
	`upload_id` text
);
--> statement-breakpoint
INSERT INTO `__new_upload_requests`("public_token_hash", "management_token_hash", "max_bytes", "created_at", "expires_at", "claim_id", "claimed_at", "consumed_at", "revoked_at", "upload_id") SELECT "public_token_hash", "management_token_hash", "max_bytes", "created_at", "expires_at", "claim_id", "claimed_at", "consumed_at", "revoked_at", "upload_id" FROM `upload_requests`;--> statement-breakpoint
DROP TABLE `upload_requests`;--> statement-breakpoint
ALTER TABLE `__new_upload_requests` RENAME TO `upload_requests`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `upload_requests_management_token_hash_unique` ON `upload_requests` (`management_token_hash`);