CREATE TABLE `taskInterviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`participantLabel` varchar(180) NOT NULL,
	`interviewDate` timestamp,
	`status` enum('planned','completed','transcribed','analyzed') NOT NULL DEFAULT 'planned',
	`recordingUrl` varchar(1024),
	`recordingConsent` boolean NOT NULL DEFAULT false,
	`transcript` text,
	`summary` text,
	`insights` text,
	`themes` json,
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `taskInterviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `taskInterviews` ADD CONSTRAINT `taskInterviews_taskId_tasks_id_fk` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taskInterviews` ADD CONSTRAINT `taskInterviews_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `taskInterviews_task_idx` ON `taskInterviews` (`taskId`);--> statement-breakpoint
CREATE INDEX `taskInterviews_status_idx` ON `taskInterviews` (`status`);