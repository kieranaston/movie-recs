import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

// Use Neon's pooled connection string; `prepare: false` is required behind PgBouncer.
const client = postgres(connectionString, {
  prepare: false,
  max: Number(process.env.DATABASE_POOL_MAX) || 10,
});
export const db = drizzle(client, { schema });
