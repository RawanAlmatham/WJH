ALTER TABLE `boardMemberships` MODIFY COLUMN `role` enum('owner','manager','member','viewer') NOT NULL DEFAULT 'member';--> statement-breakpoint
UPDATE `boardMemberships` SET `role` = 'manager' WHERE `role` = 'owner';--> statement-breakpoint
ALTER TABLE `boardMemberships` MODIFY COLUMN `role` enum('manager','member','viewer') NOT NULL DEFAULT 'member';--> statement-breakpoint
ALTER TABLE `teamInvitations` ADD `accessRole` enum('manager','member','viewer') DEFAULT 'member' NOT NULL;
