CREATE TABLE `assistantDrafts` (
	`id` varchar(32) NOT NULL,
	`boardId` int NOT NULL,
	`userId` int NOT NULL,
	`actions` json NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`appliedAt` timestamp,
	CONSTRAINT `assistantDrafts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userGroqSettings` (
	`userId` int NOT NULL,
	`encryptedApiKey` text NOT NULL,
	`apiKeyLastFour` varchar(4) NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userGroqSettings_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
ALTER TABLE `assistantDrafts` ADD CONSTRAINT `assistantDrafts_boardId_managementBoards_id_fk` FOREIGN KEY (`boardId`) REFERENCES `managementBoards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `assistantDrafts` ADD CONSTRAINT `assistantDrafts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `userGroqSettings` ADD CONSTRAINT `userGroqSettings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `assistantDrafts_owner_idx` ON `assistantDrafts` (`userId`,`boardId`);