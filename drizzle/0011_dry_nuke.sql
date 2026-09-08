CREATE TABLE `lessonsLearned` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`projectId` int NOT NULL,
	`title` varchar(240) NOT NULL,
	`category` enum('success','challenge','improvement','risk') NOT NULL,
	`lesson` text NOT NULL,
	`recommendation` text,
	`lessonDate` timestamp NOT NULL,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lessonsLearned_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `lessonsLearned` ADD CONSTRAINT `lessonsLearned_boardId_managementBoards_id_fk` FOREIGN KEY (`boardId`) REFERENCES `managementBoards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lessonsLearned` ADD CONSTRAINT `lessonsLearned_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lessonsLearned` ADD CONSTRAINT `lessonsLearned_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;