CREATE TABLE `personalLifeCategories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	CONSTRAINT `personalLifeCategories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `personalLifeTasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`userId` int NOT NULL,
	`categoryId` int,
	`title` varchar(280) NOT NULL,
	`dueDate` varchar(10),
	`executionDate` varchar(10),
	`executionTime` varchar(5),
	`focusDate` varchar(10),
	`done` boolean NOT NULL DEFAULT false,
	`version` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `personalLifeTasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `personalLifeCategories` ADD CONSTRAINT `personalLifeCategories_boardId_managementBoards_id_fk` FOREIGN KEY (`boardId`) REFERENCES `managementBoards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `personalLifeCategories` ADD CONSTRAINT `personalLifeCategories_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `personalLifeTasks` ADD CONSTRAINT `personalLifeTasks_boardId_managementBoards_id_fk` FOREIGN KEY (`boardId`) REFERENCES `managementBoards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `personalLifeTasks` ADD CONSTRAINT `personalLifeTasks_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `personalLifeTasks` ADD CONSTRAINT `personalLifeTasks_categoryId_personalLifeCategories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `personalLifeCategories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `personalCategories_owner_idx` ON `personalLifeCategories` (`boardId`,`userId`);--> statement-breakpoint
CREATE INDEX `personalTasks_owner_idx` ON `personalLifeTasks` (`boardId`,`userId`);