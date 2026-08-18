CREATE TABLE `channel_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`channelId` int NOT NULL,
	`userId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `channel_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `channel_members_channel_user_unique` UNIQUE(`channelId`,`userId`)
);
--> statement-breakpoint
ALTER TABLE `channel_members` ADD CONSTRAINT `channel_members_channelId_channels_id_fk` FOREIGN KEY (`channelId`) REFERENCES `channels`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `channel_members` ADD CONSTRAINT `channel_members_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;