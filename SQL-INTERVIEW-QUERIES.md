# ConnectHub SQL Interview Practice

This guide covers the ConnectHub MySQL tables, their purposes, the Prisma
relations between them, and SQL queries you can explain in an interview.

> **Important: live database vs. backend schema.** The current Aiven database
> still has integer IDs and connects posts to users with `posts.authorId`.
> The backend Prisma schema has been changed to UUID IDs and `posts.userId`,
> but its migration has not been applied to Aiven. The SQL below uses the
> current Aiven names, so you can run it now. After the migration, use
> `posts.userId` instead of `posts.authorId`; IDs will then be UUID strings.

## Tables: purpose, columns, and relationships

### `users`

- **Purpose:** Stores ConnectHub accounts and profile information.
- **Important columns:** `id` (primary key), `name`, `email`, `password`
  (hashed password), `role`, `avatarUrl`, `coverUrl`, `createdAt`.
- **Why separate:** Each account is stored once. Posts, comments, likes and
  other records refer to it rather than copying the user's details.

### `posts`

- **Purpose:** Stores the text and moderation state of each community post.
- **Important columns:** `id` (primary key), `title`, `description`, `views`,
  `status`, `moderationReason`, `moderatedAt`, `createdAt`, and the user
  foreign key (`authorId` in Aiven today; `userId` in the updated Prisma
  schema).
- **Why separate:** A user can create many posts; each post is stored once and
  can have its own comments, likes, views, and media.

### `comments`

- **Purpose:** Stores comments made on posts.
- **Important columns:** `id`, `content`, `userId`, `postId`, `createdAt`.
- **Connections:** `userId` refers to `users.id`; `postId` refers to
  `posts.id`.
- **Why separate:** A post can have many comments, each with its own author and
  timestamp.

### `likes`

- **Purpose:** Records which users liked which posts.
- **Important columns:** `id`, `userId`, `postId`, `createdAt`.
- **Connections:** `userId` refers to `users.id`; `postId` refers to
  `posts.id`.
- **Why separate:** Likes are a many-to-many relationship: a user can like
  many posts, and a post can be liked by many users. A unique constraint on
  `(userId, postId)` prevents duplicate likes.

### `post_views`

- **Purpose:** Remembers which signed-in users have viewed which posts.
- **Important columns:** `postId`, `userId`, `viewedAt`. The pair
  `(postId, userId)` is the composite primary key.
- **Connections:** `postId` refers to `posts.id`; `userId` refers to
  `users.id`.
- **Why separate:** It prevents counting the same user's view of the same post
  repeatedly. `posts.views` stores the total count shown by the app.

### `post_media`

- **Purpose:** Stores the file information for photos and videos attached to
  posts.
- **Important columns:** `id`, `filename`, `url`, `type`, `mimeType`, `postId`.
- **Connection:** `postId` refers to `posts.id`.
- **Why separate:** One post can have multiple files, and each file has its own
  URL and media type.

### `notifications`

- **Purpose:** Stores moderation and other notifications for users, including
  whether and when each notification was read.
- **Important columns:** `id`, `userId`, `postId`, `type`, `message`,
  `createdAt`, `readAt`.
- **Connections:** `userId` refers to `users.id`; optional `postId` refers to
  `posts.id`.
- **Why separate:** A user can receive many persistent notifications. They can
  be read or marked read independently of posts and user profile data.

## What a Prisma relation means

Prisma models describe tables. A relation connects records using a foreign
key. The scalar field such as `userId` is the database column; the relation
field such as `author` is Prisma's way to access the related `User` record.
The relation field itself is not an extra database column.

Here is the key relationship from the updated Prisma schema:

```prisma
model User {
  id    String  @id @default(uuid()) @db.Char(36)
  posts Post[]
}

model Post {
  id     String  @id @default(uuid()) @db.Char(36)
  userId String? @db.Char(36)
  author User?   @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

- `User.posts` means one user can have many posts.
- `Post.author` means each post can be connected to one user.
- `Post.userId` is the foreign-key column storing that user's ID.
- `references: [id]` means it points to `User.id`.
- `onDelete: Cascade` means deleting the user deletes their related posts.

Other relations in the Prisma schema follow the same pattern:

```prisma
model User {
  likes         Like[]
  comments      Comment[]
  postViews     PostView[]
  notifications Notification[]
}

model Post {
  likes         Like[]
  comments      Comment[]
  postViews     PostView[]
  notifications Notification[]
  media         PostMedia[]
}

model Like {
  userId String? @db.Char(36)
  postId String? @db.Char(36)
  user   User?   @relation(fields: [userId], references: [id], onDelete: Cascade)
  post   Post?   @relation(fields: [postId], references: [id], onDelete: Cascade)
}
```

The full model definitions, including all columns and constraints, are in
`prisma/schema.prisma`.

### A simple way to explain the design

> “I separated the tables because each one represents a different thing:
> users, posts, comments, likes, and media. Foreign keys connect them. This
> avoids repeating the same user and post details in every row, and it lets
> each type of data have its own rules. For example, a unique constraint
> prevents a user from liking the same post twice.”

## Basic queries

### List tables

```sql
USE defaultdb;
SHOW TABLES;
```

### Inspect a table's columns

```sql
DESCRIBE posts;
```

### Show the latest posts

```sql
SELECT id, title, createdAt
FROM posts
ORDER BY createdAt DESC
LIMIT 10;
```

### Find posts containing a word in the title

```sql
SELECT id, title
FROM posts
WHERE title LIKE '%MySQL%';
```

## JOIN queries

### Show each post with its creator's name

**Tables:** `posts` and `users`  
**Connection:** `posts.authorId = users.id`

```sql
SELECT posts.title, users.name
FROM posts
JOIN users ON posts.authorId = users.id;
```

### Show each comment with the commenter's name

**Tables:** `comments` and `users`  
**Connection:** `comments.userId = users.id`

```sql
SELECT comments.content, users.name
FROM comments
JOIN users ON comments.userId = users.id;
```

### Show comments with their post title

**Tables:** `comments` and `posts`  
**Connection:** `comments.postId = posts.id`

```sql
SELECT comments.content, posts.title
FROM comments
JOIN posts ON comments.postId = posts.id;
```

### Show posts and their like counts

**Tables:** `posts` and `likes`  
**Connection:** `likes.postId = posts.id`

```sql
SELECT posts.title, COUNT(likes.id) AS like_count
FROM posts
LEFT JOIN likes ON likes.postId = posts.id
GROUP BY posts.id, posts.title
ORDER BY like_count DESC;
```

### Count posts for each user, including users with no posts

**Tables:** `users` and `posts`  
**Connection:** `posts.authorId = users.id`

```sql
SELECT users.name, COUNT(posts.id) AS post_count
FROM users
LEFT JOIN posts ON posts.authorId = users.id
GROUP BY users.id, users.name
ORDER BY post_count DESC;
```

### Find posts that have no likes

**Tables:** `posts` and `likes`  
**Connection:** `likes.postId = posts.id`

```sql
SELECT posts.id, posts.title
FROM posts
LEFT JOIN likes ON likes.postId = posts.id
WHERE likes.id IS NULL;
```

## Common interviewer follow-ups

### "Show only posts created by one user"

Add a `WHERE` condition. Replace `1` with an existing user ID:

```sql
SELECT posts.title, users.name
FROM posts
JOIN users ON posts.authorId = users.id
WHERE users.id = 1;
```

### "Show the newest results first"

Add an `ORDER BY` clause:

```sql
SELECT posts.title, users.name, posts.createdAt
FROM posts
JOIN users ON posts.authorId = users.id
ORDER BY posts.createdAt DESC;
```

### "Return only the first five results"

Add `LIMIT 5` after sorting:

```sql
SELECT posts.title, users.name
FROM posts
JOIN users ON posts.authorId = users.id
ORDER BY posts.createdAt DESC
LIMIT 5;
```

### "Include users who have no posts"

Use `LEFT JOIN` instead of `JOIN`. `JOIN` (an inner join) returns matching
rows only; `LEFT JOIN` keeps every row from the left-hand table.

### "Show only users with more than two posts"

Use `HAVING` to filter after grouping:

```sql
SELECT users.name, COUNT(posts.id) AS post_count
FROM users
LEFT JOIN posts ON posts.authorId = users.id
GROUP BY users.id, users.name
HAVING COUNT(posts.id) > 2;
```

### "Sort by like count"

Keep the `COUNT` and `GROUP BY`, then order by the count alias:

```sql
SELECT posts.title, COUNT(likes.id) AS like_count
FROM posts
LEFT JOIN likes ON likes.postId = posts.id
GROUP BY posts.id, posts.title
ORDER BY like_count DESC;
```

## Running these in MySQL Workbench

1. Connect to the Aiven MySQL service and open a SQL tab.
2. Select a query and click the lightning-bolt **Execute** button, or put the
   cursor inside one statement and press **Ctrl+Enter**.
3. Check the Result Grid for the output.

Use `DESCRIBE table_name;` if a column name differs from the example. Practice
with `SELECT` queries first; `UPDATE` and `DELETE` change data.
