-- The title had a 150 character limit in the API while the column was only
-- VarChar(255), so removing the limit would have left the database rejecting
-- anything longer than 255 characters with a raw error. Widen the column to
-- TEXT so the API can accept a title of any length.
ALTER TABLE `posts` MODIFY COLUMN `title` TEXT NOT NULL;
