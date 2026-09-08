ALTER TABLE `tasks` ADD `needsSupport` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `tasks` ADD `supportRequest` text;