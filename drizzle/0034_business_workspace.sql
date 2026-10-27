CREATE TABLE `businessFiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`name` varchar(240) NOT NULL,
	`mime` varchar(120) NOT NULL,
	`body` longtext NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `businessFiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `businessRecords` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`kind` varchar(24) NOT NULL,
	`data` json NOT NULL,
	`version` int NOT NULL DEFAULT 1,
	`archived` boolean NOT NULL DEFAULT false,
	`convertedProjectId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `businessRecords_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `businessFiles` ADD CONSTRAINT `businessFiles_boardId_managementBoards_id_fk` FOREIGN KEY (`boardId`) REFERENCES `managementBoards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `businessRecords` ADD CONSTRAINT `businessRecords_boardId_managementBoards_id_fk` FOREIGN KEY (`boardId`) REFERENCES `managementBoards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `businessFiles_board_idx` ON `businessFiles` (`boardId`);--> statement-breakpoint
CREATE INDEX `businessRecords_board_idx` ON `businessRecords` (`boardId`,`kind`);