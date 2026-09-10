CREATE TABLE `taskAssignees` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`memberId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `taskAssignees_id` PRIMARY KEY(`id`),
	CONSTRAINT `taskAssignees_task_member_unique` UNIQUE(`taskId`,`memberId`)
);
--> statement-breakpoint
INSERT INTO `taskAssignees` (`taskId`, `memberId`)
SELECT `id`, `assigneeMemberId`
FROM `tasks`
WHERE `assigneeMemberId` IS NOT NULL;
--> statement-breakpoint
CREATE TABLE `taskChecklistItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`title` varchar(240) NOT NULL,
	`assigneeMemberId` int,
	`isComplete` boolean NOT NULL DEFAULT false,
	`position` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `taskChecklistItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `taskAssignees` ADD CONSTRAINT `taskAssignees_taskId_tasks_id_fk` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taskAssignees` ADD CONSTRAINT `taskAssignees_memberId_teamMembers_id_fk` FOREIGN KEY (`memberId`) REFERENCES `teamMembers`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taskChecklistItems` ADD CONSTRAINT `taskChecklistItems_taskId_tasks_id_fk` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `taskChecklistItems` ADD CONSTRAINT `taskChecklistItems_assigneeMemberId_teamMembers_id_fk` FOREIGN KEY (`assigneeMemberId`) REFERENCES `teamMembers`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `taskAssignees_member_idx` ON `taskAssignees` (`memberId`);--> statement-breakpoint
CREATE INDEX `taskChecklistItems_task_idx` ON `taskChecklistItems` (`taskId`);--> statement-breakpoint
CREATE INDEX `taskChecklistItems_assignee_idx` ON `taskChecklistItems` (`assigneeMemberId`);
