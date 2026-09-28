CREATE TABLE `ideaLabExperiments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`ideaId` int NOT NULL,
	`title` varchar(280) NOT NULL,
	`hypothesis` text NOT NULL,
	`successMetric` varchar(280),
	`targetValue` int,
	`currentValue` int DEFAULT 0,
	`status` enum('planned','running','review','complete') NOT NULL DEFAULT 'planned',
	`result` text,
	`ownerUserId` int,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ideaLabExperiments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ideaLabIdeas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`problemId` int,
	`title` varchar(280) NOT NULL,
	`description` text,
	`category` varchar(160),
	`audience` varchar(240),
	`stage` enum('seed','exploration','interviews','experiment','promising','archived') NOT NULL DEFAULT 'seed',
	`confidence` enum('low','medium','high') NOT NULL DEFAULT 'low',
	`ownerUserId` int,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ideaLabIdeas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ideaLabInterviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`problemId` int,
	`ideaId` int,
	`participantLabel` varchar(180) NOT NULL,
	`interviewDate` timestamp,
	`status` enum('planned','completed','transcribed','analyzed') NOT NULL DEFAULT 'planned',
	`transcript` text,
	`summary` text,
	`insights` text,
	`themes` json,
	`ownerUserId` int,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ideaLabInterviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ideaLabProblems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`title` varchar(280) NOT NULL,
	`description` text,
	`category` varchar(160),
	`audience` varchar(240),
	`stage` enum('raw','understanding','validated') NOT NULL DEFAULT 'raw',
	`evidenceStrength` enum('none','low','medium','high') NOT NULL DEFAULT 'none',
	`ownerUserId` int,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ideaLabProblems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ideaLabSources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`boardId` int NOT NULL,
	`problemId` int,
	`ideaId` int,
	`url` varchar(2048) NOT NULL,
	`sourceType` varchar(32) NOT NULL DEFAULT 'website',
	`title` varchar(500),
	`publisher` varchar(240),
	`notes` text,
	`extractedText` text,
	`aiSummary` text,
	`aiStatus` enum('not_requested','draft','approved','failed') NOT NULL DEFAULT 'not_requested',
	`analyzedByUserId` int,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ideaLabSources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userAiSettings` (
	`userId` int NOT NULL,
	`provider` enum('openai') NOT NULL DEFAULT 'openai',
	`model` varchar(120) NOT NULL DEFAULT 'gpt-4.1-mini',
	`encryptedApiKey` text NOT NULL,
	`apiKeyLastFour` varchar(4) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userAiSettings_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
ALTER TABLE `ideaLabExperiments` ADD CONSTRAINT `ideaLabExperiments_boardId_managementBoards_id_fk` FOREIGN KEY (`boardId`) REFERENCES `managementBoards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabExperiments` ADD CONSTRAINT `ideaLabExperiments_ideaId_ideaLabIdeas_id_fk` FOREIGN KEY (`ideaId`) REFERENCES `ideaLabIdeas`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabExperiments` ADD CONSTRAINT `ideaLabExperiments_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabExperiments` ADD CONSTRAINT `ideaLabExperiments_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabIdeas` ADD CONSTRAINT `ideaLabIdeas_boardId_managementBoards_id_fk` FOREIGN KEY (`boardId`) REFERENCES `managementBoards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabIdeas` ADD CONSTRAINT `ideaLabIdeas_problemId_ideaLabProblems_id_fk` FOREIGN KEY (`problemId`) REFERENCES `ideaLabProblems`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabIdeas` ADD CONSTRAINT `ideaLabIdeas_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabIdeas` ADD CONSTRAINT `ideaLabIdeas_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabInterviews` ADD CONSTRAINT `ideaLabInterviews_boardId_managementBoards_id_fk` FOREIGN KEY (`boardId`) REFERENCES `managementBoards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabInterviews` ADD CONSTRAINT `ideaLabInterviews_problemId_ideaLabProblems_id_fk` FOREIGN KEY (`problemId`) REFERENCES `ideaLabProblems`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabInterviews` ADD CONSTRAINT `ideaLabInterviews_ideaId_ideaLabIdeas_id_fk` FOREIGN KEY (`ideaId`) REFERENCES `ideaLabIdeas`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabInterviews` ADD CONSTRAINT `ideaLabInterviews_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabInterviews` ADD CONSTRAINT `ideaLabInterviews_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabProblems` ADD CONSTRAINT `ideaLabProblems_boardId_managementBoards_id_fk` FOREIGN KEY (`boardId`) REFERENCES `managementBoards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabProblems` ADD CONSTRAINT `ideaLabProblems_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabProblems` ADD CONSTRAINT `ideaLabProblems_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabSources` ADD CONSTRAINT `ideaLabSources_boardId_managementBoards_id_fk` FOREIGN KEY (`boardId`) REFERENCES `managementBoards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabSources` ADD CONSTRAINT `ideaLabSources_problemId_ideaLabProblems_id_fk` FOREIGN KEY (`problemId`) REFERENCES `ideaLabProblems`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabSources` ADD CONSTRAINT `ideaLabSources_ideaId_ideaLabIdeas_id_fk` FOREIGN KEY (`ideaId`) REFERENCES `ideaLabIdeas`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabSources` ADD CONSTRAINT `ideaLabSources_analyzedByUserId_users_id_fk` FOREIGN KEY (`analyzedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ideaLabSources` ADD CONSTRAINT `ideaLabSources_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `userAiSettings` ADD CONSTRAINT `userAiSettings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ideaLabExperiments_board_status_idx` ON `ideaLabExperiments` (`boardId`,`status`);--> statement-breakpoint
CREATE INDEX `ideaLabExperiments_idea_idx` ON `ideaLabExperiments` (`ideaId`);--> statement-breakpoint
CREATE INDEX `ideaLabIdeas_board_stage_idx` ON `ideaLabIdeas` (`boardId`,`stage`);--> statement-breakpoint
CREATE INDEX `ideaLabIdeas_problem_idx` ON `ideaLabIdeas` (`problemId`);--> statement-breakpoint
CREATE INDEX `ideaLabIdeas_owner_idx` ON `ideaLabIdeas` (`ownerUserId`);--> statement-breakpoint
CREATE INDEX `ideaLabInterviews_board_status_idx` ON `ideaLabInterviews` (`boardId`,`status`);--> statement-breakpoint
CREATE INDEX `ideaLabInterviews_idea_idx` ON `ideaLabInterviews` (`ideaId`);--> statement-breakpoint
CREATE INDEX `ideaLabProblems_board_stage_idx` ON `ideaLabProblems` (`boardId`,`stage`);--> statement-breakpoint
CREATE INDEX `ideaLabProblems_owner_idx` ON `ideaLabProblems` (`ownerUserId`);--> statement-breakpoint
CREATE INDEX `ideaLabSources_board_idx` ON `ideaLabSources` (`boardId`);--> statement-breakpoint
CREATE INDEX `ideaLabSources_problem_idx` ON `ideaLabSources` (`problemId`);--> statement-breakpoint
CREATE INDEX `ideaLabSources_idea_idx` ON `ideaLabSources` (`ideaId`);