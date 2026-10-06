/**
 * E2E harness: an in-memory Postgres (PGlite over the wire protocol) seeded with a tiny catalog
 * and two signed-in users, then the production build (`next start`) pointed at it.
 * It never touches a real database: DATABASE_URL is forced to the local PGlite server.
 */
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { drizzle } from 'drizzle-orm/pglite';
import { pushSchema } from 'drizzle-kit/api';
import * as schema from '../../src/db/schema';

export const E2E_PORT = 3100;
const DB_PORT = 54329;
const FIXTURES = path.join(__dirname, '.fixtures.json');

async function main() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await (await pushSchema(schema, db as never)).apply();

  const [action] = await db.insert(schema.genres).values({ tmdbId: 28, name: 'Action' }).returning();
  const films = await db
    .insert(schema.movies)
    .values([
      { tmdbId: 155, title: 'The Dark Knight', releaseDate: '2008-07-16' },
      { tmdbId: 27205, title: 'Inception', releaseDate: '2010-07-15' },
      { tmdbId: 496243, title: 'Parasite', releaseDate: '2019-05-30' },
    ].map((m) => ({ ...m, voteAverage: 8.5, voteCount: 20_000, popularity: 100, availableAnywhere: true })))
    .returning();
  await db.insert(schema.movieGenres).values(films.map((f) => ({ movieId: f.id, genreId: action.id })));

  const tokens: Record<string, string> = {};
  for (const email of ['alice@example.com', 'bob@example.com']) {
    const [u] = await db.insert(schema.user).values({ id: randomUUID(), email, name: email.split('@')[0], emailVerified: true }).returning();
    const token = randomBytes(24).toString('base64url');
    await db.insert(schema.session).values({
      id: randomUUID(), token, userId: u.id, userAgent: 'Playwright', updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    tokens[email.split('@')[0]] = token;
  }
  writeFileSync(FIXTURES, JSON.stringify(tokens));

  const pg = new PGLiteSocketServer({ db: client, port: DB_PORT, host: '127.0.0.1', maxConnections: 4 });
  await pg.start();

  const app = spawn('npx', ['next', 'start', '-p', String(E2E_PORT)], {
    stdio: 'inherit',
    env: {
      ...process.env,
      DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${DB_PORT}/postgres?sslmode=disable`,
      DATABASE_POOL_MAX: '1', // PGlite is single-connection; avoid its multiplexer
      BETTER_AUTH_URL: `http://localhost:${E2E_PORT}`,
      BETTER_AUTH_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e-secret',
      ALLOWED_EMAILS: 'alice@example.com,bob@example.com',
      GOOGLE_CLIENT_ID: 'e2e',
      GOOGLE_CLIENT_SECRET: 'e2e',
      TMDB_API_KEY: process.env.TMDB_API_KEY ?? 'e2e-no-tmdb',
    },
  });
  const stop = async () => {
    app.kill('SIGTERM');
    await pg.stop();
    await client.close();
    process.exit(0);
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  app.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
