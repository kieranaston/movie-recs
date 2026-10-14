/**
 * E2E harness: an in-memory Postgres (PGlite over the wire protocol) seeded with a tiny catalog
 * and two signed-in users, then the production build (`next start`) pointed at it.
 * It never touches a real database: DATABASE_URL is forced to the local PGlite server, and TMDB is a
 * local fake (movie details with a small cast), so no real API is called.
 */
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
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
const TMDB_PORT = 3101;
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
      // Enough films that rows scroll sideways and the page scrolls down.
      ...Array.from({ length: 40 }, (_, i) => ({ tmdbId: 900_000 + i, title: `Seed Film ${i + 1}`, releaseDate: `${1985 + (i % 40)}-03-01` })),
    ].map((m) => ({ ...m, voteAverage: 8.5, voteCount: 20_000, popularity: 100, availableAnywhere: true })))
    .returning();
  await db.insert(schema.movieGenres).values(films.map((f) => ({ movieId: f.id, genreId: action.id })));

  const tokens: Record<string, string> = {};
  for (const email of ['alice@example.com', 'bob@example.com']) {
    const [u] = await db.insert(schema.user).values({ id: randomUUID(), email, name: email.split('@')[0], emailVerified: true }).returning();
    const token = randomBytes(24).toString('base64url');
    await db.insert(schema.session).values({
      id: randomUUID(), token, userId: u.id, userAgent: 'Playwright', updatedAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 86_400_000), // like a fresh sign-in (30-day sessions)
    });
    tokens[email.split('@')[0]] = token;
  }
  writeFileSync(FIXTURES, JSON.stringify(tokens));

  // Fake TMDB: every /movie/:id returns the same small detail record (no images, so nothing external loads).
  const tmdb = createServer((req, res) => {
    const id = Number(/^\/movie\/(\d+)/.exec(req.url ?? '')?.[1]);
    if (!id) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({
      id, title: 'Fake Feature',
      // Long enough that the movie page clips it behind a "Read more" toggle.
      overview: 'A film used by the end-to-end tests. '.repeat(40).trim(),
      poster_path: null, backdrop_path: null,
      release_date: '2008-07-16', vote_average: 8.5, vote_count: 30000, genre_ids: [28], genres: [{ id: 28, name: 'Action' }],
      runtime: 152, status: 'Released', tagline: null, homepage: null, imdb_id: 'tt0468569', original_title: 'Fake Feature',
      original_language: 'en', production_companies: [], production_countries: [], spoken_languages: [],
      videos: { results: [] }, 'watch/providers': { results: {} },
      credits: {
        cast: [
          { id: 1, name: 'Christian Bale', character: 'Bruce Wayne', profile_path: null, order: 0 },
          { id: 2, name: 'Heath Ledger', character: 'Joker', profile_path: null, order: 1 },
        ],
        crew: [{ id: 3, name: 'Christopher Nolan', job: 'Director' }],
      },
    }));
  });
  await new Promise<void>((resolve) => tmdb.listen(TMDB_PORT, '127.0.0.1', resolve));

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
      TMDB_API_KEY: 'e2e',
      TMDB_BASE_URL: `http://127.0.0.1:${TMDB_PORT}`,
    },
  });
  const stop = async () => {
    app.kill('SIGTERM');
    tmdb.close();
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
