CREATE TABLE `applicationSettings` (
	`settingKey` varchar(96) NOT NULL,
	`settingValue` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `applicationSettings_settingKey` PRIMARY KEY(`settingKey`)
);
--> statement-breakpoint
CREATE TABLE `browserPushSubscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`endpoint` varchar(512) NOT NULL,
	`p256dh` varchar(255) NOT NULL,
	`auth` varchar(255) NOT NULL,
	`enabledTypes` json NOT NULL,
	`expirationTime` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `browserPushSubscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `browserPushSubscriptions_endpoint_unique` UNIQUE(`endpoint`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`boardId` int NOT NULL,
	`type` varchar(48) NOT NULL,
	`title` varchar(240) NOT NULL,
	`message` text NOT NULL,
	`actorUserId` int,
	`taskId` int,
	`taskCommentId` int,
	`calendarEventId` int,
	`projectId` int,
	`link` varchar(512) NOT NULL,
	`dedupeKey` varchar(191) NOT NULL,
	`occurrenceCount` int NOT NULL DEFAULT 1,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `notifications_user_dedupe_unique` UNIQUE(`userId`,`dedupeKey`)
);
--> statement-breakpoint
ALTER TABLE `calendarEvents` ADD `updatedAt` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `taskComments` ADD `replyToCommentId` int;--> statement-breakpoint
ALTER TABLE `browserPushSubscriptions` ADD CONSTRAINT `browserPushSubscriptions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_boardId_managementBoards_id_fk` FOREIGN KEY (`boardId`) REFERENCES `managementBoards`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_taskId_tasks_id_fk` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_taskCommentId_taskComments_id_fk` FOREIGN KEY (`taskCommentId`) REFERENCES `taskComments`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_calendarEventId_calendarEvents_id_fk` FOREIGN KEY (`calendarEventId`) REFERENCES `calendarEvents`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `browserPushSubscriptions_user_idx` ON `browserPushSubscriptions` (`userId`);--> statement-breakpoint
CREATE INDEX `notifications_user_board_read_idx` ON `notifications` (`userId`,`boardId`,`readAt`);--> statement-breakpoint
ALTER TABLE `taskComments` ADD CONSTRAINT `taskComments_replyToCommentId_taskComments_id_fk` FOREIGN KEY (`replyToCommentId`) REFERENCES `taskComments`(`id`) ON DELETE cascade ON UPDATE no action;
