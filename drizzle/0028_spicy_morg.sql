CREATE TABLE `ideaLabSubtasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`taskId` int NOT NULL,
	`title` varchar(280) NOT NULL,
	`description` text,
	`status` enum('todo','in_progress','blocked','done') NOT NULL DEFAULT 'todo',
	`assigneeUserId` int,
	`dueDate` timestamp,
	`completedAt` timestamp,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ideaLabSubtasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ideaLabSubtasks` ADD CONSTRAINT `ideaLabSubtasks_boardId_managementBoards_id_fk` FOREIGN KEY (`boardId`) REFERENCES `managementBoards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabSubtasks` ADD CONSTRAINT `ideaLabSubtasks_taskId_ideaLabTasks_id_fk` FOREIGN KEY (`taskId`) REFERENCES `ideaLabTasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabSubtasks` ADD CONSTRAINT `ideaLabSubtasks_assigneeUserId_users_id_fk` FOREIGN KEY (`assigneeUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabSubtasks` ADD CONSTRAINT `ideaLabSubtasks_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ideaLabSubtasks_task_idx` ON `ideaLabSubtasks` (`boardId`,`taskId`);