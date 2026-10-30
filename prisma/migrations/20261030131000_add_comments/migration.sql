CREATE TABLE `comments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `content` TEXT NOT NULL,
    `userId` INTEGER NULL,
    `postId` INTEGER NULL,
    `createdAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `comments_userId_idx`(`userId`),
    INDEX `comments_postId_idx`(`postId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `comments`
    ADD CONSTRAINT `comments_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `comments`
    ADD CONSTRAINT `comments_postId_fkey`
    FOREIGN KEY (`postId`) REFERENCES `posts`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
