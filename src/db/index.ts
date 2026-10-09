import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

function connect() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  // Use Neon's pooled connection string; `prepare: false` is required behind PgBouncer.
  const client = postgres(connectionString, {
    prepare: false,
    max: Number(process.env.DATABASE_POOL_MAX) || 10,
  });
  return drizzle(client, { schema });
}

type Database = ReturnType<typeof connect>;
// Next bundles route handlers, pages and server actions separately, each with its own copy of this
// module. One pool per process (on globalThis) keeps them from each opening their own connections.
const shared = globalThis as typeof globalThis & { movieRecsDb?: Database };

/**
 * The database, connected on first use. `next build` imports every route but never queries,
 * so builds (e.g. Vercel previews) don't need DATABASE_URL; a missing value fails on first query.
 */
export const db = new Proxy({} as Database, {
  get(_target, prop) {
    const instance = (shared.movieRecsDb ??= connect());
    const value = Reflect.get(instance, prop, instance);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
