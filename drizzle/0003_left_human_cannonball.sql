CREATE TABLE `deliverableComments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deliverableId` int NOT NULL,
	`authorUserId` int NOT NULL,
	`body` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deliverableComments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teamInvitations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`memberId` int NOT NULL,
	`invitedByUserId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`token` varchar(64) NOT NULL,
	`status` enum('pending','accepted','cancelled') NOT NULL DEFAULT 'pending',
	`acceptedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `teamInvitations_id` PRIMARY KEY(`id`),
	CONSTRAINT `teamInvitations_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
ALTER TABLE `teamMembers` ADD `userId` int;--> statement-breakpoint
ALTER TABLE `deliverableComments` ADD CONSTRAINT `deliverableComments_deliverableId_deliverables_id_fk` FOREIGN KEY (`deliverableId`) REFERENCES `deliverables`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `deliverableComments` ADD CONSTRAINT `deliverableComments_authorUserId_users_id_fk` FOREIGN KEY (`authorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teamInvitations` ADD CONSTRAINT `teamInvitations_memberId_teamMembers_id_fk` FOREIGN KEY (`memberId`) REFERENCES `teamMembers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teamInvitations` ADD CONSTRAINT `teamInvitations_invitedByUserId_users_id_fk` FOREIGN KEY (`invitedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `teamMembers` ADD CONSTRAINT `teamMembers_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;