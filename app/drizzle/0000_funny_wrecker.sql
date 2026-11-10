CREATE TABLE `listings` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`fingerprint` text NOT NULL,
	`revision` integer NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`body` text NOT NULL,
	`sources` text DEFAULT '{"boards":[],"apify":false}' NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`lock_until` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`status` text NOT NULL,
	`imported` integer DEFAULT 0 NOT NULL,
	`message` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_runs_user_started` ON `runs` (`user_id`,`started_at`);