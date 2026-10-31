CREATE TEMPORARY TABLE `_uuid_map_users` (
    `old_id` INTEGER NOT NULL PRIMARY KEY,
    `new_id` CHAR(36) NOT NULL
) ENGINE=InnoDB;
CREATE TEMPORARY TABLE `_uuid_map_posts` LIKE `_uuid_map_users`;
CREATE TEMPORARY TABLE `_uuid_map_likes` LIKE `_uuid_map_users`;
CREATE TEMPORARY TABLE `_uuid_map_comments` LIKE `_uuid_map_users`;
CREATE TEMPORARY TABLE `_uuid_map_notifications` LIKE `_uuid_map_users`;
CREATE TEMPORARY TABLE `_uuid_map_post_media` LIKE `_uuid_map_users`;

INSERT INTO `_uuid_map_users` (`old_id`, `new_id`)
SELECT `id`, UUID() FROM `users`;
INSERT INTO `_uuid_map_posts` (`old_id`, `new_id`)
SELECT `id`, UUID() FROM `posts`;
INSERT INTO `_uuid_map_likes` (`old_id`, `new_id`)
SELECT `id`, UUID() FROM `likes`;
INSERT INTO `_uuid_map_comments` (`old_id`, `new_id`)
SELECT `id`, UUID() FROM `comments`;
INSERT INTO `_uuid_map_notifications` (`old_id`, `new_id`)
SELECT `id`, UUID() FROM `notifications`;
INSERT INTO `_uuid_map_post_media` (`old_id`, `new_id`)
SELECT `id`, UUID() FROM `post_media`;

ALTER TABLE `users`
    ADD COLUMN `id_uuid` CHAR(36) NULL;
ALTER TABLE `posts`
    ADD COLUMN `id_uuid` CHAR(36) NULL,
    ADD COLUMN `userId_uuid` CHAR(36) NULL;
ALTER TABLE `likes`
    ADD COLUMN `id_uuid` CHAR(36) NULL,
    ADD COLUMN `userId_uuid` CHAR(36) NULL,
    ADD COLUMN `postId_uuid` CHAR(36) NULL;
ALTER TABLE `comments`
    ADD COLUMN `id_uuid` CHAR(36) NULL,
    ADD COLUMN `userId_uuid` CHAR(36) NULL,
    ADD COLUMN `postId_uuid` CHAR(36) NULL;
ALTER TABLE `post_views`
    ADD COLUMN `postId_uuid` CHAR(36) NULL,
    ADD COLUMN `userId_uuid` CHAR(36) NULL;
ALTER TABLE `notifications`
    ADD COLUMN `id_uuid` CHAR(36) NULL,
    ADD COLUMN `userId_uuid` CHAR(36) NULL,
    ADD COLUMN `postId_uuid` CHAR(36) NULL;
ALTER TABLE `post_media`
    ADD COLUMN `id_uuid` CHAR(36) NULL,
    ADD COLUMN `postId_uuid` CHAR(36) NULL;

UPDATE `users` u
JOIN `_uuid_map_users` m ON m.`old_id` = u.`id`
SET u.`id_uuid` = m.`new_id`;

UPDATE `posts` p
JOIN `_uuid_map_posts` pm ON pm.`old_id` = p.`id`
SET p.`id_uuid` = pm.`new_id`;
UPDATE `posts` p
JOIN `_uuid_map_users` um ON um.`old_id` = p.`authorId`
SET p.`userId_uuid` = um.`new_id`;

UPDATE `likes` l
JOIN `_uuid_map_likes` lm ON lm.`old_id` = l.`id`
SET l.`id_uuid` = lm.`new_id`;
UPDATE `likes` l
JOIN `_uuid_map_users` um ON um.`old_id` = l.`userId`
SET l.`userId_uuid` = um.`new_id`;
UPDATE `likes` l
JOIN `_uuid_map_posts` pm ON pm.`old_id` = l.`postId`
SET l.`postId_uuid` = pm.`new_id`;

UPDATE `comments` c
JOIN `_uuid_map_comments` cm ON cm.`old_id` = c.`id`
SET c.`id_uuid` = cm.`new_id`;
UPDATE `comments` c
JOIN `_uuid_map_users` um ON um.`old_id` = c.`userId`
SET c.`userId_uuid` = um.`new_id`;
UPDATE `comments` c
JOIN `_uuid_map_posts` pm ON pm.`old_id` = c.`postId`
SET c.`postId_uuid` = pm.`new_id`;

UPDATE `post_views` pv
JOIN `_uuid_map_posts` pm ON pm.`old_id` = pv.`postId`
SET pv.`postId_uuid` = pm.`new_id`;
UPDATE `post_views` pv
JOIN `_uuid_map_users` um ON um.`old_id` = pv.`userId`
SET pv.`userId_uuid` = um.`new_id`;

UPDATE `notifications` n
JOIN `_uuid_map_notifications` nm ON nm.`old_id` = n.`id`
SET n.`id_uuid` = nm.`new_id`;
UPDATE `notifications` n
JOIN `_uuid_map_users` um ON um.`old_id` = n.`userId`
SET n.`userId_uuid` = um.`new_id`;
UPDATE `notifications` n
JOIN `_uuid_map_posts` pm ON pm.`old_id` = n.`postId`
SET n.`postId_uuid` = pm.`new_id`;

UPDATE `post_media` pm
JOIN `_uuid_map_post_media` mm ON mm.`old_id` = pm.`id`
SET pm.`id_uuid` = mm.`new_id`;
UPDATE `post_media` pm
JOIN `_uuid_map_posts` pmap ON pmap.`old_id` = pm.`postId`
SET pm.`postId_uuid` = pmap.`new_id`;

SET @sql = (
    SELECT CONCAT(
        'ALTER TABLE `posts` ',
        GROUP_CONCAT(CONCAT('DROP FOREIGN KEY `', CONSTRAINT_NAME, '`') SEPARATOR ', ')
    )
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'posts'
      AND COLUMN_NAME = 'authorId'
      AND REFERENCED_TABLE_NAME IS NOT NULL
);
PREPARE migration_stmt FROM @sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @sql = (
    SELECT CONCAT(
        'ALTER TABLE `likes` ',
        GROUP_CONCAT(CONCAT('DROP FOREIGN KEY `', CONSTRAINT_NAME, '`') SEPARATOR ', ')
    )
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'likes'
      AND COLUMN_NAME IN ('userId', 'postId')
      AND REFERENCED_TABLE_NAME IS NOT NULL
);
PREPARE migration_stmt FROM @sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @sql = (
    SELECT CONCAT(
        'ALTER TABLE `comments` ',
        GROUP_CONCAT(CONCAT('DROP FOREIGN KEY `', CONSTRAINT_NAME, '`') SEPARATOR ', ')
    )
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'comments'
      AND COLUMN_NAME IN ('userId', 'postId')
      AND REFERENCED_TABLE_NAME IS NOT NULL
);
PREPARE migration_stmt FROM @sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @sql = (
    SELECT CONCAT(
        'ALTER TABLE `post_views` ',
        GROUP_CONCAT(CONCAT('DROP FOREIGN KEY `', CONSTRAINT_NAME, '`') SEPARATOR ', ')
    )
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'post_views'
      AND COLUMN_NAME IN ('userId', 'postId')
      AND REFERENCED_TABLE_NAME IS NOT NULL
);
PREPARE migration_stmt FROM @sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @sql = (
    SELECT CONCAT(
        'ALTER TABLE `notifications` ',
        GROUP_CONCAT(CONCAT('DROP FOREIGN KEY `', CONSTRAINT_NAME, '`') SEPARATOR ', ')
    )
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'notifications'
      AND COLUMN_NAME IN ('userId', 'postId')
      AND REFERENCED_TABLE_NAME IS NOT NULL
);
PREPARE migration_stmt FROM @sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @sql = (
    SELECT CONCAT(
        'ALTER TABLE `post_media` ',
        GROUP_CONCAT(CONCAT('DROP FOREIGN KEY `', CONSTRAINT_NAME, '`') SEPARATOR ', ')
    )
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'post_media'
      AND COLUMN_NAME = 'postId'
      AND REFERENCED_TABLE_NAME IS NOT NULL
);
PREPARE migration_stmt FROM @sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @sql = (
    SELECT CONCAT(
        'ALTER TABLE `posts` ',
        GROUP_CONCAT(DISTINCT CONCAT('DROP INDEX `', INDEX_NAME, '`') SEPARATOR ', ')
    )
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'posts'
      AND COLUMN_NAME IN ('id', 'authorId')
      AND INDEX_NAME <> 'PRIMARY'
);
PREPARE migration_stmt FROM @sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @sql = (
    SELECT CONCAT(
        'ALTER TABLE `likes` ',
        GROUP_CONCAT(DISTINCT CONCAT('DROP INDEX `', INDEX_NAME, '`') SEPARATOR ', ')
    )
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'likes'
      AND COLUMN_NAME IN ('id', 'userId', 'postId')
      AND INDEX_NAME <> 'PRIMARY'
);
PREPARE migration_stmt FROM @sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @sql = (
    SELECT CONCAT(
        'ALTER TABLE `comments` ',
        GROUP_CONCAT(DISTINCT CONCAT('DROP INDEX `', INDEX_NAME, '`') SEPARATOR ', ')
    )
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'comments'
      AND COLUMN_NAME IN ('id', 'userId', 'postId')
      AND INDEX_NAME <> 'PRIMARY'
);
PREPARE migration_stmt FROM @sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @sql = (
    SELECT CONCAT(
        'ALTER TABLE `post_views` ',
        GROUP_CONCAT(DISTINCT CONCAT('DROP INDEX `', INDEX_NAME, '`') SEPARATOR ', ')
    )
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'post_views'
      AND COLUMN_NAME IN ('postId', 'userId')
      AND INDEX_NAME <> 'PRIMARY'
);
PREPARE migration_stmt FROM @sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @sql = (
    SELECT CONCAT(
        'ALTER TABLE `notifications` ',
        GROUP_CONCAT(DISTINCT CONCAT('DROP INDEX `', INDEX_NAME, '`') SEPARATOR ', ')
    )
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'notifications'
      AND COLUMN_NAME IN ('id', 'userId', 'postId')
      AND INDEX_NAME <> 'PRIMARY'
);
PREPARE migration_stmt FROM @sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @sql = (
    SELECT CONCAT(
        'ALTER TABLE `post_media` ',
        GROUP_CONCAT(DISTINCT CONCAT('DROP INDEX `', INDEX_NAME, '`') SEPARATOR ', ')
    )
    FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'post_media'
      AND COLUMN_NAME IN ('id', 'postId')
      AND INDEX_NAME <> 'PRIMARY'
);
PREPARE migration_stmt FROM @sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

ALTER TABLE `users`
    DROP PRIMARY KEY,
    DROP COLUMN `id`,
    CHANGE COLUMN `id_uuid` `id` CHAR(36) NOT NULL,
    ADD PRIMARY KEY (`id`);

ALTER TABLE `posts`
    DROP PRIMARY KEY,
    DROP COLUMN `id`,
    DROP COLUMN `authorId`,
    CHANGE COLUMN `id_uuid` `id` CHAR(36) NOT NULL,
    CHANGE COLUMN `userId_uuid` `userId` CHAR(36) NULL,
    ADD PRIMARY KEY (`id`),
    ADD INDEX `posts_userId_idx` (`userId`);

ALTER TABLE `likes`
    DROP PRIMARY KEY,
    DROP COLUMN `id`,
    DROP COLUMN `userId`,
    DROP COLUMN `postId`,
    CHANGE COLUMN `id_uuid` `id` CHAR(36) NOT NULL,
    CHANGE COLUMN `userId_uuid` `userId` CHAR(36) NULL,
    CHANGE COLUMN `postId_uuid` `postId` CHAR(36) NULL,
    ADD PRIMARY KEY (`id`),
    ADD UNIQUE INDEX `likes_userId_postId_key` (`userId`, `postId`),
    ADD INDEX `likes_userId_idx` (`userId`),
    ADD INDEX `likes_postId_idx` (`postId`);

ALTER TABLE `comments`
    DROP PRIMARY KEY,
    DROP COLUMN `id`,
    DROP COLUMN `userId`,
    DROP COLUMN `postId`,
    CHANGE COLUMN `id_uuid` `id` CHAR(36) NOT NULL,
    CHANGE COLUMN `userId_uuid` `userId` CHAR(36) NULL,
    CHANGE COLUMN `postId_uuid` `postId` CHAR(36) NULL,
    ADD PRIMARY KEY (`id`),
    ADD INDEX `comments_userId_idx` (`userId`),
    ADD INDEX `comments_postId_idx` (`postId`);

ALTER TABLE `post_views`
    DROP PRIMARY KEY,
    DROP COLUMN `postId`,
    DROP COLUMN `userId`,
    CHANGE COLUMN `postId_uuid` `postId` CHAR(36) NOT NULL,
    CHANGE COLUMN `userId_uuid` `userId` CHAR(36) NOT NULL,
    ADD PRIMARY KEY (`postId`, `userId`),
    ADD INDEX `post_views_userId_idx` (`userId`);

ALTER TABLE `notifications`
    DROP PRIMARY KEY,
    DROP COLUMN `id`,
    DROP COLUMN `userId`,
    DROP COLUMN `postId`,
    CHANGE COLUMN `id_uuid` `id` CHAR(36) NOT NULL,
    CHANGE COLUMN `userId_uuid` `userId` CHAR(36) NOT NULL,
    CHANGE COLUMN `postId_uuid` `postId` CHAR(36) NULL,
    ADD PRIMARY KEY (`id`),
    ADD INDEX `notifications_userId_readAt_createdAt_idx` (`userId`, `readAt`, `createdAt`);

ALTER TABLE `post_media`
    DROP PRIMARY KEY,
    DROP COLUMN `id`,
    DROP COLUMN `postId`,
    CHANGE COLUMN `id_uuid` `id` CHAR(36) NOT NULL,
    CHANGE COLUMN `postId_uuid` `postId` CHAR(36) NULL,
    ADD PRIMARY KEY (`id`),
    ADD INDEX `post_media_postId_idx` (`postId`);

ALTER TABLE `posts`
    ADD CONSTRAINT `posts_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `likes`
    ADD CONSTRAINT `likes_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `likes_postId_fkey`
    FOREIGN KEY (`postId`) REFERENCES `posts`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `comments`
    ADD CONSTRAINT `comments_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `comments_postId_fkey`
    FOREIGN KEY (`postId`) REFERENCES `posts`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `post_views`
    ADD CONSTRAINT `post_views_postId_fkey`
    FOREIGN KEY (`postId`) REFERENCES `posts`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `post_views_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `notifications`
    ADD CONSTRAINT `notifications_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `notifications_postId_fkey`
    FOREIGN KEY (`postId`) REFERENCES `posts`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `post_media`
    ADD CONSTRAINT `post_media_postId_fkey`
    FOREIGN KEY (`postId`) REFERENCES `posts`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE;

DROP TEMPORARY TABLE `_uuid_map_users`;
DROP TEMPORARY TABLE `_uuid_map_posts`;
DROP TEMPORARY TABLE `_uuid_map_likes`;
DROP TEMPORARY TABLE `_uuid_map_comments`;
DROP TEMPORARY TABLE `_uuid_map_notifications`;
DROP TEMPORARY TABLE `_uuid_map_post_media`;
