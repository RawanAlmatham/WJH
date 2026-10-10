CREATE TABLE `commerceResources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`title` varchar(280) NOT NULL,
	`url` text NOT NULL,
	`notes` text,
	`archived` boolean NOT NULL DEFAULT false,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `commerceResources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `commerceSections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`archived` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `commerceSections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `commerceTasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`sectionId` int NOT NULL,
	`title` varchar(280) NOT NULL,
	`description` text,
	`status` enum('todo','in_progress','blocked','done') NOT NULL DEFAULT 'todo',
	`priority` enum('normal','urgent') NOT NULL DEFAULT 'normal',
	`assigneeUserId` int,
	`dueDate` varchar(10),
	`waitingReason` text,
	`checklist` json,
	`archived` boolean NOT NULL DEFAULT false,
	`version` int NOT NULL DEFAULT 1,
	`createdByUserId` int NOT NULL,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `commerceTasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `commerceResources` ADD CONSTRAINT `commerceResources_boardId_managementBoards_id_fk` FOREIGN KEY (`boardId`) REFERENCES `managementBoards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commerceResources` ADD CONSTRAINT `commerceResources_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commerceSections` ADD CONSTRAINT `commerceSections_boardId_managementBoards_id_fk` FOREIGN KEY (`boardId`) REFERENCES `managementBoards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commerceTasks` ADD CONSTRAINT `commerceTasks_boardId_managementBoards_id_fk` FOREIGN KEY (`boardId`) REFERENCES `managementBoards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commerceTasks` ADD CONSTRAINT `commerceTasks_sectionId_commerceSections_id_fk` FOREIGN KEY (`sectionId`) REFERENCES `commerceSections`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commerceTasks` ADD CONSTRAINT `commerceTasks_assigneeUserId_users_id_fk` FOREIGN KEY (`assigneeUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commerceTasks` ADD CONSTRAINT `commerceTasks_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `commerceSections_board_idx` ON `commerceSections` (`boardId`);--> statement-breakpoint
CREATE INDEX `commerceTasks_board_idx` ON `commerceTasks` (`boardId`,`sectionId`);--> statement-breakpoint
CREATE INDEX `commerceTasks_assignee_idx` ON `commerceTasks` (`assigneeUserId`);