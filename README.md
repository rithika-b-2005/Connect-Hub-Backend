# ConnectHub — Backend

NestJS REST API for ConnectHub, a community posts platform with JWT authentication, role-based access control, and post analytics.

**Frontend repo:** https://github.com/rithika-b-2005/Connect-Hub-Frontend

## Tech Stack

- **NestJS 11** (TypeScript)
- **MySQL 8** with **TypeORM**
- **JWT** authentication (Passport)
- **bcrypt** password hashing
- **class-validator** request validation

## Features

- Signup / Login / Logout with JWT (1-day expiry)
- Role-based access control — `admin` and `user` roles via a custom `@Roles()` decorator + `RolesGuard`
- User management (admin only): search by name/email, filter by role, promote/demote, delete
- Posts: users create posts; everyone sees the feed; owners delete their own posts; admin moderates (deletes any post, cannot create)
- Likes: one like per user per post (DB unique constraint), toggle endpoint
- Views: feed loads count as impressions on other users' posts
- Analytics: one role-aware endpoint — admin gets platform totals, users get their own stats
- Auto-seeding: admin account + demo users/posts/likes created on first boot

## API Overview

| Method | Route | Access |
|--------|-------|--------|
| POST | /auth/signup | public |
| POST | /auth/login | public |
| POST | /auth/logout | authenticated |
| GET | /auth/profile | authenticated |
| GET | /users?search=&role= | admin |
| GET | /users/me | authenticated |
| PATCH | /users/me | authenticated (name / password change) |
| PATCH | /users/:id/role | admin |
| DELETE | /users/:id | admin |
| GET | /posts | authenticated |
| POST | /posts | user only |
| POST | /posts/:id/like | user only |
| DELETE | /posts/:id | owner or admin |
| GET | /analytics/summary | authenticated (role-aware response) |

## Setup

```bash
npm install
cp .env.example .env   # fill in your MySQL credentials
npm run start:dev      # http://localhost:3000
```

Tables are auto-created from entities (`synchronize: true` — dev convenience; production would use migrations). Demo data seeds automatically on first boot.

### Environment variables

See `.env.example`. Set `DB_SSL=true` for managed MySQL providers (e.g. Aiven) that require TLS.

## Demo accounts (seeded)

| Email | Password | Role |
|-------|----------|------|
| admin@connecthub.com | admin123 | admin |
| alex@connecthub.com | user123 | user |
| priya@connecthub.com | user123 | user |
| rahul@connecthub.com | user123 | user |

## Security notes

- Passwords hashed with bcrypt (10 rounds); password column excluded from queries by default
- Role lives in the database and inside the signed JWT — never chosen by the client
- Guards enforce permissions on every request; UI hiding is UX, guards are security
- Logout is client-side token removal (stateless JWT); a production system could add a refresh-token denylist
