import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { sql } from 'drizzle-orm';
import { pushSchema } from 'drizzle-kit/api';
import * as schema from '@/db/schema';

/** A fresh in-memory Postgres (PGlite) with the app schema applied. */
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  // drizzle-kit's push diff: identical DDL to `npm run db:push`, without a migrations folder.
  const { apply } = await pushSchema(schema, db as never);
  await apply();
  return db;
}

export type TestDb = Awaited<ReturnType<typeof createTestDb>>;

/** Empty every app table (keeps the schema). */
export async function resetDb(db: TestDb) {
  await db.execute(sql`
    truncate table "user", session, account, verification, device_code, rate_limit,
      user_watchlist, api_rate_limit, watchlist, movie_watch_providers, watch_providers,
      movie_companies, production_companies, movie_keywords, keywords, movie_genres, genres, movies
    restart identity cascade
  `);
}
