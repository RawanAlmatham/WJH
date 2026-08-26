CREATE TABLE `taskAttachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`fileUrl` varchar(1024) NOT NULL,
	`mimeType` varchar(128),
	`uploadedByMemberId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `taskAttachments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `taskComments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`authorMemberId` int NOT NULL,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `taskComments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `taskAttachments` ADD CONSTRAINT `taskAttachments_taskId_tasks_id_fk` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taskAttachments` ADD CONSTRAINT `taskAttachments_uploadedByMemberId_teamMembers_id_fk` FOREIGN KEY (`uploadedByMemberId`) REFERENCES `teamMembers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taskComments` ADD CONSTRAINT `taskComments_taskId_tasks_id_fk` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taskComments` ADD CONSTRAINT `taskComments_authorMemberId_teamMembers_id_fk` FOREIGN KEY (`authorMemberId`) REFERENCES `teamMembers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_parentTaskId_tasks_id_fk` FOREIGN KEY (`parentTaskId`) REFERENCES `tasks`(`id`) ON DELETE no action ON UPDATE no action;