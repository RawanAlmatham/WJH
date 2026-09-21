ALTER TABLE `calendarEvents` MODIFY COLUMN `type` enum('meeting','delivery','launch','workshop','review','activity','flight','stay','transport','meal') NOT NULL;--> statement-breakpoint
ALTER TABLE `calendarEvents` ADD `location` varchar(320);--> statement-breakpoint
ALTER TABLE `calendarEvents` ADD `notes` text;