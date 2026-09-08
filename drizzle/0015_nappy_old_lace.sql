CREATE TABLE `researchFeedItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`source` varchar(32) NOT NULL,
	`externalId` varchar(191) NOT NULL,
	`title` varchar(600) NOT NULL,
	`abstract` text,
	`url` varchar(1024) NOT NULL,
	`authors` json NOT NULL,
	`publishedAt` timestamp NOT NULL,
	`projectId` int,
	`discoveredAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `researchFeedItems_id` PRIMARY KEY(`id`),
	CONSTRAINT `researchFeedItems_board_source_external_unique` UNIQUE(`boardId`,`source`,`externalId`)
);
--> statement-breakpoint
CREATE TABLE `researchFeedMatches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`interestId` int NOT NULL,
	`feedItemId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `researchFeedMatches_id` PRIMARY KEY(`id`),
	CONSTRAINT `researchFeedMatches_interest_item_unique` UNIQUE(`interestId`,`feedItemId`)
);
--> statement-breakpoint
CREATE TABLE `researchInterests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`keywords` json NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdByUserId` int NOT NULL,
	`lastFetchedAt` timestamp,
	`lastFetchStatus` enum('idle','success','error') NOT NULL DEFAULT 'idle',
	`lastFetchMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `researchInterests_id` PRIMARY KEY(`id`),
	CONSTRAINT `researchInterests_board_name_unique` UNIQUE(`boardId`,`name`)
);
--> statement-breakpoint
ALTER TABLE `researchFeedItems` ADD CONSTRAINT `researchFeedItems_boardId_managementBoards_id_fk` FOREIGN KEY (`boardId`) REFERENCES `managementBoards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `researchFeedItems` ADD CONSTRAINT `researchFeedItems_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `researchFeedMatches` ADD CONSTRAINT `researchFeedMatches_interestId_researchInterests_id_fk` FOREIGN KEY (`interestId`) REFERENCES `researchInterests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `researchFeedMatches` ADD CONSTRAINT `researchFeedMatches_feedItemId_researchFeedItems_id_fk` FOREIGN KEY (`feedItemId`) REFERENCES `researchFeedItems`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `researchInterests` ADD CONSTRAINT `researchInterests_boardId_managementBoards_id_fk` FOREIGN KEY (`boardId`) REFERENCES `managementBoards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `researchInterests` ADD CONSTRAINT `researchInterests_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
UPDATE `managementBoards`
SET `enabledModules` = JSON_ARRAY_APPEND(`enabledModules`, '$', 'feeds')
WHERE `enabledModules` IS NOT NULL
  AND JSON_CONTAINS(`enabledModules`, JSON_QUOTE('feeds')) = 0;
