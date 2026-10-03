ALTER TABLE `upload_metadata` ADD `max_downloads` integer;
--> statement-breakpoint
ALTER TABLE `upload_metadata` ADD `download_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `upload_metadata` ADD `encrypted` integer DEFAULT 0 NOT NULL;
