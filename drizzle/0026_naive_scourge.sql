CREATE TABLE `ideaLabTasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`problemId` int,
	`ideaId` int,
	`interviewId` int,
	`experimentId` int,
	`title` varchar(280) NOT NULL,
	`description` text,
	`status` enum('todo','in_progress','blocked','done') NOT NULL DEFAULT 'todo',
	`priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
	`dueDate` timestamp,
	`assigneeUserId` int,
	`createdByUserId` int NOT NULL,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ideaLabTasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ideaLabTasks` ADD CONSTRAINT `ideaLabTasks_boardId_managementBoards_id_fk` FOREIGN KEY (`boardId`) REFERENCES `managementBoards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabTasks` ADD CONSTRAINT `ideaLabTasks_problemId_ideaLabProblems_id_fk` FOREIGN KEY (`problemId`) REFERENCES `ideaLabProblems`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabTasks` ADD CONSTRAINT `ideaLabTasks_ideaId_ideaLabIdeas_id_fk` FOREIGN KEY (`ideaId`) REFERENCES `ideaLabIdeas`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabTasks` ADD CONSTRAINT `ideaLabTasks_interviewId_ideaLabInterviews_id_fk` FOREIGN KEY (`interviewId`) REFERENCES `ideaLabInterviews`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabTasks` ADD CONSTRAINT `ideaLabTasks_experimentId_ideaLabExperiments_id_fk` FOREIGN KEY (`experimentId`) REFERENCES `ideaLabExperiments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabTasks` ADD CONSTRAINT `ideaLabTasks_assigneeUserId_users_id_fk` FOREIGN KEY (`assigneeUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabTasks` ADD CONSTRAINT `ideaLabTasks_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ideaLabTasks_board_status_idx` ON `ideaLabTasks` (`boardId`,`status`);--> statement-breakpoint
CREATE INDEX `ideaLabTasks_assignee_idx` ON `ideaLabTasks` (`assigneeUserId`);--> statement-breakpoint
CREATE INDEX `ideaLabTasks_due_date_idx` ON `ideaLabTasks` (`boardId`,`dueDate`);--> statement-breakpoint
CREATE INDEX `ideaLabTasks_problem_idx` ON `ideaLabTasks` (`problemId`);--> statement-breakpoint
CREATE INDEX `ideaLabTasks_idea_idx` ON `ideaLabTasks` (`ideaId`);