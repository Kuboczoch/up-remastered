ALTER TABLE `upload_metadata` DROP COLUMN `password_hash`;--> statement-breakpoint
ALTER TABLE `upload_metadata` DROP COLUMN `download_limit`;--> statement-breakpoint
ALTER TABLE `upload_metadata` DROP COLUMN `download_count`;--> statement-breakpoint
DROP INDEX `upload_metadata_token_unique`;--> statement-breakpoint
ALTER TABLE `upload_metadata` DROP COLUMN `token`;