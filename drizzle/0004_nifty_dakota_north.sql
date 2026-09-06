CREATE TABLE `boardMemberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('owner','member') NOT NULL DEFAULT 'member',
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `boardMemberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `boardMemberships_board_user_unique` UNIQUE(`boardId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `managementBoards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`ownerUserId` int NOT NULL,
	`joinCode` varchar(12) NOT NULL,
	`inviteToken` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `managementBoards_id` PRIMARY KEY(`id`),
	CONSTRAINT `managementBoards_joinCode_unique` UNIQUE(`joinCode`),
	CONSTRAINT `managementBoards_inviteToken_unique` UNIQUE(`inviteToken`)
);
--> statement-breakpoint
ALTER TABLE `boardMemberships` ADD CONSTRAINT `boardMemberships_boardId_managementBoards_id_fk` FOREIGN KEY (`boardId`) REFERENCES `managementBoards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `boardMemberships` ADD CONSTRAINT `boardMemberships_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `managementBoards` ADD CONSTRAINT `managementBoards_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;