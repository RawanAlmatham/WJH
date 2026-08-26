CREATE TABLE `annualGoals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(240) NOT NULL,
	`theme` varchar(160) NOT NULL,
	`year` int NOT NULL,
	`ownerMemberId` int,
	`progress` int NOT NULL DEFAULT 0,
	`status` enum('on_track','attention','at_risk','complete') NOT NULL DEFAULT 'on_track',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `annualGoals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `calendarEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(240) NOT NULL,
	`projectId` int,
	`eventDate` timestamp NOT NULL,
	`type` enum('meeting','delivery','launch','workshop','review') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `calendarEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deliverables` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`title` varchar(240) NOT NULL,
	`dueDate` timestamp,
	`progress` int NOT NULL DEFAULT 0,
	`status` enum('not_started','in_progress','in_review','complete') NOT NULL DEFAULT 'not_started',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deliverables_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projectMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`memberId` int NOT NULL,
	CONSTRAINT `projectMembers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(240) NOT NULL,
	`summary` text,
	`annualGoalId` int,
	`ownerMemberId` int NOT NULL,
	`startDate` timestamp NOT NULL,
	`endDate` timestamp NOT NULL,
	`progress` int NOT NULL DEFAULT 0,
	`isManualProgress` boolean NOT NULL DEFAULT false,
	`status` enum('planned','in_progress','in_review','complete','blocked') NOT NULL DEFAULT 'planned',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `projects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `taskParticipants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`memberId` int NOT NULL,
	CONSTRAINT `taskParticipants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(240) NOT NULL,
	`description` text,
	`projectId` int,
	`deliverableId` int,
	`parentTaskId` int,
	`assigneeMemberId` int,
	`startDate` timestamp,
	`dueDate` timestamp,
	`priority` enum('urgent','high','medium','low') NOT NULL DEFAULT 'medium',
	`status` enum('not_started','in_progress','in_review','complete','overdue') NOT NULL DEFAULT 'not_started',
	`isApprovalPending` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teamMembers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(160) NOT NULL,
	`role` varchar(160) NOT NULL,
	`email` varchar(320),
	`color` varchar(16) NOT NULL DEFAULT '#6C8FB8',
	`avatarInitials` varchar(8) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teamMembers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `annualGoals` ADD CONSTRAINT `annualGoals_ownerMemberId_teamMembers_id_fk` FOREIGN KEY (`ownerMemberId`) REFERENCES `teamMembers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `calendarEvents` ADD CONSTRAINT `calendarEvents_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deliverables` ADD CONSTRAINT `deliverables_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectMembers` ADD CONSTRAINT `projectMembers_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projectMembers` ADD CONSTRAINT `projectMembers_memberId_teamMembers_id_fk` FOREIGN KEY (`memberId`) REFERENCES `teamMembers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_annualGoalId_annualGoals_id_fk` FOREIGN KEY (`annualGoalId`) REFERENCES `annualGoals`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_ownerMemberId_teamMembers_id_fk` FOREIGN KEY (`ownerMemberId`) REFERENCES `teamMembers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taskParticipants` ADD CONSTRAINT `taskParticipants_taskId_tasks_id_fk` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taskParticipants` ADD CONSTRAINT `taskParticipants_memberId_teamMembers_id_fk` FOREIGN KEY (`memberId`) REFERENCES `teamMembers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_deliverableId_deliverables_id_fk` FOREIGN KEY (`deliverableId`) REFERENCES `deliverables`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_assigneeMemberId_teamMembers_id_fk` FOREIGN KEY (`assigneeMemberId`) REFERENCES `teamMembers`(`id`) ON DELETE no action ON UPDATE no action;