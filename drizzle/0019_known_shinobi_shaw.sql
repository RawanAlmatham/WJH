ALTER TABLE `researchFeedItems` ADD `abstractArabic` text;--> statement-breakpoint
ALTER TABLE `researchFeedItems` ADD `abstractArabicSourceHash` varchar(64);--> statement-breakpoint
ALTER TABLE `researchFeedItems` ADD `abstractArabicUpdatedAt` timestamp;--> statement-breakpoint
ALTER TABLE `researchFeedItems` ADD `abstractArabicUpdatedByUserId` int;--> statement-breakpoint
ALTER TABLE `researchFeedItems` ADD CONSTRAINT `researchFeedItems_abstractArabicUpdatedByUserId_users_id_fk` FOREIGN KEY (`abstractArabicUpdatedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;