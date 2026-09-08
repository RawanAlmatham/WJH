ALTER TABLE `teamMembers` ADD `projectAccess` enum('all','selected') DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE `teamMembers` ADD `allowedProjectIds` json;