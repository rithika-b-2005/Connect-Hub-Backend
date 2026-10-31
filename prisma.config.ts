import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// Build the connection URL the CLI needs out of the DB_* variables the
// runtime already uses.
//
// The service is configured with DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD
// and DB_NAME, because that is what @prisma/adapter-mariadb reads at runtime
// (src/prisma/prisma.service.ts). The Prisma CLI does not read those — it
// wants DATABASE_URL. Without this the CLI falls back to a placeholder host
// name and `prisma migrate deploy`, which the start command runs, fails on
// every deploy: the deploy is marked failed, the previous build keeps
// serving, and the change never reaches the running app.
//
// The password is percent-encoded because Aiven generates one with
// characters that are not URL-safe.
function urlFromDbVariables(): string | null {
  const { DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME } = process.env;

  if (!DB_HOST || !DB_USERNAME || !DB_PASSWORD || !DB_NAME) return null;

  const port = DB_PORT || '3306';
  const user = encodeURIComponent(DB_USERNAME);
  const password = encodeURIComponent(DB_PASSWORD);
  // Aiven serves a self-signed certificate, so the CLI has to be told not to
  // verify it. This mirrors DB_SSL, which the runtime adapter reads.
  const ssl = process.env.DB_SSL === 'true' ? '?sslaccept=accept_invalid_certs' : '';

  return `mysql://${user}:${password}@${DB_HOST}:${port}/${DB_NAME}${ssl}`;
}

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
    // missing connection must not be fatal here — otherwise a fresh clone
    // cannot install. The placeholder host name is deliberately loud: the
    // migrate commands that genuinely need a database fail with it.
    url:
      process.env.DATABASE_URL ??
      urlFromDbVariables() ??
      'mysql://DATABASE_URL-is-not-set:DATABASE_URL-is-not-set@DATABASE_URL-is-not-set:3306/DATABASE_URL-is-not-set',
  },
});
