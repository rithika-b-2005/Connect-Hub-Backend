ALTER TABLE `posts`
    ADD COLUMN `status` ENUM('active', 'restricted', 'hidden') NOT NULL DEFAULT 'active',
    ADD COLUMN `moderationReason` VARCHAR(1000) NULL,
    ADD COLUMN `moderatedAt` DATETIME(6) NULL;

CREATE TABLE `notifications` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `postId` INTEGER NULL,
    `type` VARCHAR(32) NOT NULL,
    `message` VARCHAR(1000) NOT NULL,
    `createdAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    `readAt` DATETIME(6) NULL,

    INDEX `notifications_userId_readAt_createdAt_idx`(`userId`, `readAt`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `notifications`
    ADD CONSTRAINT `notifications_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `notifications`
    ADD CONSTRAINT `notifications_postId_fkey`
    FOREIGN KEY (`postId`) REFERENCES `posts`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
