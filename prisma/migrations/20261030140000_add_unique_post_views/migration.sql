CREATE TABLE `post_views` (
    `postId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `viewedAt` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),

    INDEX `post_views_userId_idx`(`userId`),
    PRIMARY KEY (`postId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `post_views`
    ADD CONSTRAINT `post_views_postId_fkey`
    FOREIGN KEY (`postId`) REFERENCES `posts`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `post_views`
    ADD CONSTRAINT `post_views_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
