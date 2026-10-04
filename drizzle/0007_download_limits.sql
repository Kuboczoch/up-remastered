ALTER TABLE `upload_metadata` ADD `max_downloads` integer;--> statement-breakpoint
ALTER TABLE `upload_metadata` ADD `download_count` integer DEFAULT 0 NOT NULL;