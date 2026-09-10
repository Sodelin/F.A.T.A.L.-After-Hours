CREATE TABLE `campaigns` (
	`id` text PRIMARY KEY NOT NULL,
	`state` text NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`last_operation` text,
	`created_at` integer NOT NULL,
	CONSTRAINT "campaign_revision_positive" CHECK("campaigns"."revision" >= 0)
);
--> statement-breakpoint
CREATE TABLE `invites` (
	`hash` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "invite_revoked" CHECK("invites"."revoked" IN (0, 1))
);
--> statement-breakpoint
CREATE INDEX `invites_campaign` ON `invites` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`campaign_id` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`session_hash` text NOT NULL,
	`resume_hash` text,
	`revoked` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "membership_role" CHECK("memberships"."role" IN ('gm', 'player')),
	CONSTRAINT "membership_revoked" CHECK("memberships"."revoked" IN (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_session_hash_unique` ON `memberships` (`session_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `memberships_resume_hash_unique` ON `memberships` (`resume_hash`);--> statement-breakpoint
CREATE INDEX `memberships_campaign` ON `memberships` (`campaign_id`);--> statement-breakpoint
CREATE TABLE `operations` (
	`campaign_id` text NOT NULL,
	`member_id` text NOT NULL,
	`operation_id` text NOT NULL,
	`payload_hash` text NOT NULL,
	`result` text NOT NULL,
	PRIMARY KEY(`campaign_id`, `member_id`, `operation_id`),
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `memberships`(`id`) ON UPDATE no action ON DELETE cascade
);
