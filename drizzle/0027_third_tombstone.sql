CREATE TABLE `ideaLabCaptures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`ideaId` int,
	`captureType` enum('problem','idea','link','note','feedback','statistic','competitor') NOT NULL DEFAULT 'note',
	`title` varchar(500) NOT NULL,
	`content` text,
	`url` varchar(2048),
	`status` enum('inbox','attached','archived') NOT NULL DEFAULT 'inbox',
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ideaLabCaptures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ideaLabIdeas` ADD `valueProposition` text;--> statement-breakpoint
ALTER TABLE `ideaLabIdeas` ADD `proposedSolution` text;--> statement-breakpoint
ALTER TABLE `ideaLabIdeas` ADD `differentiator` text;--> statement-breakpoint
ALTER TABLE `ideaLabIdeas` ADD `mvpScope` text;--> statement-breakpoint
ALTER TABLE `ideaLabIdeas` ADD `assumptions` json;--> statement-breakpoint
ALTER TABLE `ideaLabIdeas` ADD `decision` enum('undecided','continue','pivot','test_more','stop','approved') DEFAULT 'undecided' NOT NULL;--> statement-breakpoint
ALTER TABLE `ideaLabIdeas` ADD `decisionRationale` text;--> statement-breakpoint
ALTER TABLE `ideaLabIdeas` ADD `decisionAt` timestamp;--> statement-breakpoint
ALTER TABLE `ideaLabCaptures` ADD CONSTRAINT `ideaLabCaptures_boardId_managementBoards_id_fk` FOREIGN KEY (`boardId`) REFERENCES `managementBoards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabCaptures` ADD CONSTRAINT `ideaLabCaptures_ideaId_ideaLabIdeas_id_fk` FOREIGN KEY (`ideaId`) REFERENCES `ideaLabIdeas`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabCaptures` ADD CONSTRAINT `ideaLabCaptures_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ideaLabCaptures_board_status_idx` ON `ideaLabCaptures` (`boardId`,`status`);--> statement-breakpoint
CREATE INDEX `ideaLabCaptures_idea_idx` ON `ideaLabCaptures` (`ideaId`);