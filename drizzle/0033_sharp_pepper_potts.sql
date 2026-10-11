CREATE TABLE `mobileLoginTickets` (
	`codeHash` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`challenge` varchar(64) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `mobileLoginTickets_codeHash` PRIMARY KEY(`codeHash`)
);
--> statement-breakpoint
ALTER TABLE `mobileLoginTickets` ADD CONSTRAINT `mobileLoginTickets_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `mobileLoginTickets_expiry_idx` ON `mobileLoginTickets` (`expiresAt`);