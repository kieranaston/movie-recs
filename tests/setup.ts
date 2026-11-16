// Deterministic env for tests — never real secrets or real databases.
process.env.DATABASE_URL = 'postgres://unused-in-tests';
process.env.TMDB_API_KEY = 'test-tmdb-key';
process.env.SITE_PASSWORD = 'test-password';

import { vi } from 'vitest';

// Each test file gets its own in-memory Postgres in place of Neon (created lazily on first import).
vi.mock('@/db', async () => {
  const { createTestDb } = await import('./helpers/test-db');
  return { db: await createTestDb() };
});
vi.mock('next/cache', async () => (await import('./helpers/next-stubs')).nextCache);

// Server actions read the login cookie via next/headers; tests act as the signed-in owner by default.
vi.mock('next/headers', async () => {
  const { createHmac } = await import('node:crypto');
  const token = createHmac('sha256', 'test-password').update('movie-recs-owner').digest('hex');
  return {
    cookies: async () => ({ get: (n: string) => (n === 'owner' ? { name: n, value: token } : undefined) }),
    headers: async () => new Headers(),
  };
});
