CREATE TABLE `ideaLabConsultations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`ideaId` int NOT NULL,
	`title` varchar(280) NOT NULL,
	`consultant` varchar(280) NOT NULL,
	`goal` text NOT NULL,
	`status` enum('preparing','ready','completed') NOT NULL DEFAULT 'preparing',
	`questions` json NOT NULL,
	`summary` text NOT NULL,
	`recommendations` text NOT NULL,
	`taskId` int,
	`version` int NOT NULL DEFAULT 1,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ideaLabConsultations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ideaLabConsultations` ADD CONSTRAINT `ideaLabConsultations_boardId_managementBoards_id_fk` FOREIGN KEY (`boardId`) REFERENCES `managementBoards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabConsultations` ADD CONSTRAINT `ideaLabConsultations_ideaId_ideaLabIdeas_id_fk` FOREIGN KEY (`ideaId`) REFERENCES `ideaLabIdeas`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabConsultations` ADD CONSTRAINT `ideaLabConsultations_taskId_ideaLabTasks_id_fk` FOREIGN KEY (`taskId`) REFERENCES `ideaLabTasks`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabConsultations` ADD CONSTRAINT `ideaLabConsultations_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ideaLabConsultations_idea_idx` ON `ideaLabConsultations` (`boardId`,`ideaId`);