// Deterministic env for tests — never real secrets or real databases.
process.env.DATABASE_URL = 'postgres://unused-in-tests';
process.env.TMDB_API_KEY = 'test-tmdb-key';

import { vi } from 'vitest';

// Each test file gets its own in-memory Postgres in place of Neon (created lazily on first import).
vi.mock('@/db', async () => {
  const { createTestDb } = await import('./helpers/test-db');
  return { db: await createTestDb() };
});
vi.mock('next/cache', async () => (await import('./helpers/next-stubs')).nextCache);
