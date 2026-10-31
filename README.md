# ConnectHub — Backend

NestJS REST API for ConnectHub, a community posts platform with JWT authentication, role-based access control, and post analytics.

**Frontend repo:** https://github.com/rithika-b-2005/Connect-Hub-Frontend

## Tech Stack

- **NestJS 11** (TypeScript)
- **MySQL 8** with **Prisma ORM**
- **JWT** authentication (Passport)
- **bcrypt** password hashing
- **class-validator** request validation

## Features

- Signup / Login / Logout with JWT (1-day expiry)
- Role-based access control — `admin` and `user` roles via a custom `@Roles()` decorator + `RolesGuard`
- User management (admin only): search by name/email, filter by role, promote/demote, delete
- Posts: users create and delete their own posts; admins can restrict or hide posts with a required reason, or restore them; authors receive in-app notifications
- Moderation: hidden posts are visible only to the author and admins; restricted posts remain visible but cannot receive likes or comments
- Notifications: users and admins can view their own persistent notifications and mark them read
- Likes: one like per user per post (DB unique constraint), toggle endpoint
- Views: opening another user's post details counts once per signed-in user and post; authors and feed refreshes do not add views
- Comments: users can add multiple comments to posts; comments cascade with their post or author
- Analytics: one role-aware endpoint — admin gets platform totals, users get their own stats
- Development-only seeding: a generated admin credential and demo users/posts/likes

## API Overview

| Method | Route                     | Access                                 |
| ------ | ------------------------- | -------------------------------------- |
| POST   | /auth/signup              | public                                 |
| POST   | /auth/login               | public                                 |
| POST   | /auth/logout              | authenticated                          |
| GET    | /auth/profile             | authenticated                          |
| GET    | /users?search=&role=      | admin                                  |
| GET    | /users/me                 | authenticated                          |
| PATCH  | /users/me                 | authenticated (name / password change) |
| PATCH  | /users/:id                | admin (name and/or role)               |
| POST   | /users/:id/reset-password | admin                                  |
| DELETE | /users/:id                | admin                                  |
| POST   | /users/me/avatar          | authenticated                          |
| POST   | /users/me/cover           | authenticated                          |
| GET    | /posts                    | authenticated                          |
| POST   | /posts                    | user only                              |
| POST   | /posts/:id/like           | user only                              |
| POST   | /posts/:id/comments       | user only                              |
| PATCH   | /posts/:id/moderation     | admin (restrict / hide / restore)      |
| DELETE  | /posts/:id                | owner                                  |
| GET     | /notifications/me         | authenticated                          |
| PATCH   | /notifications/:id/read  | authenticated (own notification)       |
| PATCH   | /notifications/me/read-all | authenticated                         |
| GET    | /analytics/summary        | authenticated (role-aware response)    |

## Setup

```bash
npm install
npm run db:generate
cp .env.example .env   # fill in your MySQL credentials
npm run start:dev      # http://localhost:3000
```

Prisma Client generation runs before production builds, after the schema is
available to the build step. Run `npm run db:generate` after installing
dependencies for local development.

The API uses Prisma Migrate; it does not auto-create or synchronize tables at startup.
For a **new empty database**, run `npm run db:migrate` before starting the API.
For an **existing database created before Prisma**, first compare its tables with
`prisma/schema.prisma`. Only when the existing schema matches the baseline
`0_init` migration, run `npm run db:baseline` once to record that baseline
without executing its table-creation SQL, then run `npm run db:migrate` to apply
new migrations. Do not baseline an empty or mismatched database.

The UUID migration replaces integer primary keys and updates all related
foreign keys while preserving existing rows. Back up the database before
applying it, and stop API writes while it runs. Existing numeric-ID API links
and JWT sessions will no longer be valid after migration; users must sign in
again.

Demo accounts, posts, and likes are seeded only when `NODE_ENV=development`.
The development user accounts use `user123`; the generated development admin
password is printed once in the API startup log. Do not use demo credentials in
production.

### Environment variables

Configure the database credentials and `JWT_SECRET` in the deployment platform.
Set `DB_SSL=true` for managed MySQL providers (e.g. Aiven) that require TLS.
Set `CORS_ORIGINS` to a comma-separated list of trusted frontend origins. It
defaults to the deployed frontend plus the local Vite dev server (`5173`) and
preview server (`4173`), so a browser on a dev machine can talk to the API
without extra setup. Origins that are not listed are blocked by the browser
even when the request itself succeeds, which looks like a network error in the
app.

### Deploy as a Render web service

The repository includes a `render.yaml` Blueprint for a Node web service. In
Render, create a Blueprint from this repository and provide the prompted
database variables (`DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`,
`DB_NAME`, and `DATABASE_URL`). The blueprint builds the NestJS app, applies
Prisma migrations at service startup, and starts `dist/main.js`. `JWT_SECRET`
is generated by Render. `CORS_ORIGINS` allows requests from the deployed
frontend plus the local dev origins; update it if the frontend domain changes.
Redeploy the backend after changing this setting.

After deployment, verify `https://<your-render-service>.onrender.com/health`.
It should return `{"status":"ok"}` after successfully connecting to MySQL.
Then set the frontend Netlify environment variable `VITE_API_URL` to
`https://<your-render-service>.onrender.com` and trigger a new frontend deploy.

Uploaded files currently use local disk storage. Ephemeral service filesystems
can lose uploads during restarts or redeploys, so move uploads to durable object
storage or attach a persistent disk before relying on production media uploads.

### Media storage

Images and videos live in an S3-compatible bucket — Cloudflare R2 by default.
They do **not** live on this service's disk: Render's filesystem is ephemeral,
so a file written there is gone after the next deploy, and the request body
would have to carry the whole video through this process.

The browser uploads the file itself:

1. `POST /media/presign` with the kind, the MIME type and the size. The API
   checks the type against the allowlist, builds a key and answers with a
   presigned URL.
2. The browser `PUT`s the bytes straight to the bucket.
3. `POST /posts` (or `/users/me/avatar`) carries the key. The API derives the
   URL, the type and the MIME type from the key, so a client cannot make the
   app render an address of its choosing.

**Cloudflare R2 setup**

1. Dashboard → R2 → *Create bucket*, name it `connect-hub-media`.
2. R2 → *Manage R2 API Tokens* → *Create API Token* → *Object Read & Write*.
   Copy the **Access Key ID** and **Secret Access Key**.
3. R2 → the bucket → *Settings* → *Public access* → *Connect a domain* (or use
   the `r2.dev` address it offers for development).
4. The bucket needs a CORS policy so the browser may PUT to it. Bucket →
   *Settings* → *CORS policy*:

   ```json
   [
     {
       "AllowedOrigins": [
         "https://connect-hub-frontend-1.onrender.com",
         "http://localhost:5173",
         "http://localhost:4173"
       ],
       "AllowedMethods": ["GET", "HEAD", "PUT"],
       "AllowedHeaders": ["Content-Type"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

5. Set these environment variables on the service:

   | Variable | Value |
   | --- | --- |
   | `S3_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
   | `S3_REGION` | `auto` |
   | `S3_BUCKET` | `connect-hub-media` |
   | `S3_ACCESS_KEY_ID` | from the API token |
   | `S3_SECRET_ACCESS_KEY` | from the API token |
   | `S3_PUBLIC_URL` | the bucket's public base, e.g. `https://pub-<hash>.r2.dev/connect-hub-media` |

`GET /media/status` answers `{"configured": true}` once they are all set. Until
then uploads are refused with a 503 and the app says so, rather than silently
writing to a disk that will be wiped.

The same code works with Backblaze B2 or AWS S3 — only the endpoint and the
public base change.

### Database environment variables

The service is configured with `DB_HOST`, `DB_PORT`, `DB_USERNAME`,
`DB_PASSWORD`, `DB_NAME` and `DB_SSL`. That is what the runtime reads —
`@prisma/adapter-mariadb` takes an explicit config object
(`src/prisma/prisma.service.ts`), not a URL.

The Prisma CLI reads a URL instead, and the start command runs
`prisma migrate deploy` before starting the app. `prisma.config.ts` builds
that URL from the `DB_*` variables when `DATABASE_URL` is not set, so the
service does not need a second set of credentials. Without that fallback the
CLI connects to a placeholder host name, every deploy fails at the migrate
step, and the previous build keeps serving — the change never reaches the
running app, and the only symptom is an API that keeps behaving like the
build before it.

`DATABASE_URL` still overrides it when it is set.

### Primary keys are UUIDs

Every model uses a `CHAR(36)` id instead of an autoincrementing integer. Two
things about that are worth knowing before changing the schema.

**A foreign key needs matching collations.** The tables in this database were
created with two different collations — the ones from `0_init` use the server
default `utf8mb4_0900_ai_ci`, the ones added later use `utf8mb4_unicode_ci`.
MySQL refuses a foreign key between two `CHAR(36)` columns with different
collations, and the failure lands on the `ALTER TABLE ... ADD CONSTRAINT`
statement, long after the columns were converted. Every `CHAR(36)` column in
the migrations therefore states its charset and collation explicitly:

```sql
`id` CHAR(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL
```

Keep that on any new column that takes part in a foreign key.

**`prisma/migrations/migration_lock.toml` is required.** Without it Prisma
cannot tell which connector the migrations belong to, and `prisma migrate
deploy` — which the start command runs — fails before it applies anything.

To check what the database looks like against the schema:

```bash
npx prisma migrate status --schema prisma/schema.prisma
```

## Demo accounts (seeded)

| Email                | Password                                                  | Role  |
| -------------------- | --------------------------------------------------------- | ----- |
| admin@connecthub.com | generated at first development startup; check the API log | admin |
| alex@connecthub.com  | user123                                                   | user  |
| priya@connecthub.com | user123                                                   | user  |
| rahul@connecthub.com | user123                                                   | user  |

## Security notes

- Passwords hashed with bcrypt (10 rounds); password column excluded from queries by default
- Role is loaded from the database for every authenticated request; a role change invalidates existing tokens
- Guards enforce permissions on every request; UI hiding is UX, guards are security
- Logout is client-side token removal (stateless JWT); a production system could add a refresh-token denylist
