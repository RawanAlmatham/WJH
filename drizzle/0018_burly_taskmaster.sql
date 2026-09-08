CREATE TABLE `oauthAuthorizationCodes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codeHash` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`clientId` varchar(255) NOT NULL,
	`redirectUri` varchar(1024) NOT NULL,
	`codeChallenge` varchar(128) NOT NULL,
	`scopes` json NOT NULL,
	`resource` varchar(1024) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`usedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `oauthAuthorizationCodes_id` PRIMARY KEY(`id`),
	CONSTRAINT `oauthAuthorizationCodes_codeHash_unique` UNIQUE(`codeHash`)
);
--> statement-breakpoint
CREATE TABLE `oauthClients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` varchar(255) NOT NULL,
	`clientName` varchar(180) NOT NULL,
	`redirectUris` json NOT NULL,
	`tokenEndpointAuthMethod` varchar(32) NOT NULL DEFAULT 'none',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `oauthClients_id` PRIMARY KEY(`id`),
	CONSTRAINT `oauthClients_clientId_unique` UNIQUE(`clientId`)
);
--> statement-breakpoint
CREATE TABLE `oauthTokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accessTokenHash` varchar(64) NOT NULL,
	`refreshTokenHash` varchar(64) NOT NULL,
	`userId` int NOT NULL,
	`clientId` varchar(255) NOT NULL,
	`scopes` json NOT NULL,
	`resource` varchar(1024) NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`refreshExpiresAt` timestamp NOT NULL,
	`lastUsedAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `oauthTokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `oauthTokens_accessTokenHash_unique` UNIQUE(`accessTokenHash`),
	CONSTRAINT `oauthTokens_refreshTokenHash_unique` UNIQUE(`refreshTokenHash`)
);
--> statement-breakpoint
ALTER TABLE `oauthAuthorizationCodes` ADD CONSTRAINT `oauthAuthorizationCodes_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `oauthTokens` ADD CONSTRAINT `oauthTokens_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;