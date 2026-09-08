CREATE TABLE `managerInvitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`email` varchar(320) NOT NULL,
	`token` varchar(64) NOT NULL,
	`invitedByUserId` int NOT NULL,
	`acceptedByUserId` int,
	`status` enum('pending','accepted','cancelled') NOT NULL DEFAULT 'pending',
	`acceptedAt` timestamp,
	`cancelledAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `managerInvitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `managerInvitations_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','manager','admin') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `annualGoals` ADD `boardId` int;--> statement-breakpoint
ALTER TABLE `calendarEvents` ADD `boardId` int;--> statement-breakpoint
ALTER TABLE `projects` ADD `boardId` int;--> statement-breakpoint
ALTER TABLE `tasks` ADD `boardId` int;--> statement-breakpoint
ALTER TABLE `teamMembers` ADD `boardId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `activeBoardId` int;--> statement-breakpoint
UPDATE `users` AS `u`
SET `activeBoardId` = (
	SELECT MIN(`bm`.`boardId`)
	FROM `boardMemberships` AS `bm`
	WHERE `bm`.`userId` = `u`.`id`
)
WHERE `u`.`activeBoardId` IS NULL;--> statement-breakpoint
UPDATE `teamMembers` AS `tm`
JOIN `teamInvitations` AS `ti` ON `ti`.`memberId` = `tm`.`id`
SET `tm`.`boardId` = `ti`.`boardId`
WHERE `tm`.`boardId` IS NULL AND `ti`.`boardId` IS NOT NULL;--> statement-breakpoint
UPDATE `teamMembers` AS `tm`
JOIN `users` AS `u` ON `u`.`id` = `tm`.`userId`
SET `tm`.`boardId` = `u`.`activeBoardId`
WHERE `tm`.`boardId` IS NULL AND `u`.`activeBoardId` IS NOT NULL;--> statement-breakpoint
UPDATE `teamMembers`
SET `boardId` = (SELECT MIN(`id`) FROM `managementBoards`)
WHERE `boardId` IS NULL;--> statement-breakpoint
UPDATE `annualGoals` AS `goal`
LEFT JOIN `teamMembers` AS `member` ON `member`.`id` = `goal`.`ownerMemberId`
SET `goal`.`boardId` = COALESCE(`member`.`boardId`, (SELECT MIN(`id`) FROM `managementBoards`))
WHERE `goal`.`boardId` IS NULL;--> statement-breakpoint
UPDATE `projects` AS `project`
LEFT JOIN `teamMembers` AS `member` ON `member`.`id` = `project`.`ownerMemberId`
LEFT JOIN `annualGoals` AS `goal` ON `goal`.`id` = `project`.`annualGoalId`
SET `project`.`boardId` = COALESCE(`member`.`boardId`, `goal`.`boardId`, (SELECT MIN(`id`) FROM `managementBoards`))
WHERE `project`.`boardId` IS NULL;--> statement-breakpoint
UPDATE `tasks` AS `task`
LEFT JOIN `projects` AS `project` ON `project`.`id` = `task`.`projectId`
LEFT JOIN `teamMembers` AS `member` ON `member`.`id` = `task`.`assigneeMemberId`
SET `task`.`boardId` = COALESCE(`project`.`boardId`, `member`.`boardId`, (SELECT MIN(`id`) FROM `managementBoards`))
WHERE `task`.`boardId` IS NULL;--> statement-breakpoint
UPDATE `calendarEvents` AS `event`
LEFT JOIN `projects` AS `project` ON `project`.`id` = `event`.`projectId`
SET `event`.`boardId` = COALESCE(`project`.`boardId`, (SELECT MIN(`id`) FROM `managementBoards`))
WHERE `event`.`boardId` IS NULL;--> statement-breakpoint
UPDATE `teamInvitations` AS `invitation`
JOIN `teamMembers` AS `member` ON `member`.`id` = `invitation`.`memberId`
SET `invitation`.`boardId` = `member`.`boardId`
WHERE `invitation`.`boardId` IS NULL;--> statement-breakpoint
INSERT INTO `boardMemberships` (`boardId`, `userId`, `role`, `joinedAt`)
SELECT `invitation`.`boardId`, `member`.`userId`, `invitation`.`accessRole`, COALESCE(`invitation`.`acceptedAt`, `invitation`.`createdAt`)
FROM `teamInvitations` AS `invitation`
JOIN `teamMembers` AS `member` ON `member`.`id` = `invitation`.`memberId`
WHERE `invitation`.`status` = 'accepted'
	AND `invitation`.`boardId` IS NOT NULL
	AND `member`.`userId` IS NOT NULL
	AND NOT EXISTS (
		SELECT 1
		FROM `boardMemberships` AS `membership`
		WHERE `membership`.`boardId` = `invitation`.`boardId`
			AND `membership`.`userId` = `member`.`userId`
	);--> statement-breakpoint
UPDATE `users` AS `u`
SET `activeBoardId` = (
	SELECT MIN(`bm`.`boardId`)
	FROM `boardMemberships` AS `bm`
	WHERE `bm`.`userId` = `u`.`id`
)
WHERE `u`.`activeBoardId` IS NULL;--> statement-breakpoint
ALTER TABLE `teamMembers` ADD CONSTRAINT `teamMembers_board_user_unique` UNIQUE(`boardId`,`userId`);--> statement-breakpoint
ALTER TABLE `managerInvitations` ADD CONSTRAINT `managerInvitations_invitedByUserId_users_id_fk` FOREIGN KEY (`invitedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `managerInvitations` ADD CONSTRAINT `managerInvitations_acceptedByUserId_users_id_fk` FOREIGN KEY (`acceptedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `annualGoals` ADD CONSTRAINT `annualGoals_boardId_managementBoards_id_fk` FOREIGN KEY (`boardId`) REFERENCES `managementBoards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `calendarEvents` ADD CONSTRAINT `calendarEvents_boardId_managementBoards_id_fk` FOREIGN KEY (`boardId`) REFERENCES `managementBoards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_boardId_managementBoards_id_fk` FOREIGN KEY (`boardId`) REFERENCES `managementBoards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_boardId_managementBoards_id_fk` FOREIGN KEY (`boardId`) REFERENCES `managementBoards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teamMembers` ADD CONSTRAINT `teamMembers_boardId_managementBoards_id_fk` FOREIGN KEY (`boardId`) REFERENCES `managementBoards`(`id`) ON DELETE no action ON UPDATE no action;
