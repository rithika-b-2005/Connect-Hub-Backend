import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Prisma 7 reads the datasource URL from here rather than from schema.prisma.
// The runtime path does NOT use this URL — the app connects through
// @prisma/adapter-mariadb with an explicit config object (src/prisma/prisma.service.ts).
// This URL is only used by the CLI: migrate / migrate resolve / migrate status.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // `prisma generate` runs on npm install and needs no database, so a
    // missing DATABASE_URL must not be fatal here — otherwise a fresh clone
    // cannot install. The placeholder host name is deliberately loud: the
    // migrate commands that genuinely need a database fail with it.
    url:
      process.env.DATABASE_URL ??
      'mysql://DATABASE_URL-is-not-set:DATABASE_URL-is-not-set@DATABASE_URL-is-not-set:3306/DATABASE_URL-is-not-set',
  },
});
