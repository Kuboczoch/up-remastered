CREATE TABLE `upload_requests` (
	`public_token_hash` text PRIMARY KEY NOT NULL,
	`management_token_hash` text NOT NULL,
	`max_bytes` integer NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`claim_id` text,
	`claimed_at` integer,
	`consumed_at` integer,
	`revoked_at` integer,
	`upload_id` text,
	FOREIGN KEY (`upload_id`) REFERENCES `upload_metadata`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `upload_requests_management_token_hash_unique` ON `upload_requests` (`management_token_hash`);