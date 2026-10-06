import { randomUUID } from 'node:crypto';
import { db } from '@/db';
import { genres, movieGenres, movies, user as userTable } from '@/db/schema';
import { auth } from '@/lib/auth';
import type { TestDb } from './test-db';

export const SEED_MOVIES = [
  { tmdbId: 155, title: 'The Dark Knight', releaseDate: '2008-07-16' },
  { tmdbId: 27205, title: 'Inception', releaseDate: '2010-07-15' },
  { tmdbId: 496243, title: 'Parasite', releaseDate: '2019-05-30' },
];

/** A tiny catalog whose films clear the quality gates (rating 8.5, 20k votes, streaming somewhere). */
export async function seedCatalog(db: TestDb) {
  const [action] = await db.insert(genres).values({ tmdbId: 28, name: 'Action' }).returning();
  const rows = await db
    .insert(movies)
    .values(SEED_MOVIES.map((m) => ({ ...m, voteAverage: 8.5, voteCount: 20_000, popularity: 100, posterPath: `/p${m.tmdbId}.jpg`, availableAnywhere: true })))
    .returning();
  await db.insert(movieGenres).values(rows.map((r) => ({ movieId: r.id, genreId: action.id })));
  return rows;
}

/**
 * A user (inserted directly, as after a Google sign-in) with a live session created by Better Auth,
 * so the session-level allowlist hook runs.
 */
export async function createUserWithSession(email: string, name = email.split('@')[0]) {
  const [user] = await db.insert(userTable).values({ id: randomUUID(), email, name, emailVerified: true }).returning();
  const ctx = await auth.$context;
  const session = await ctx.internalAdapter.createSession(user.id);
  return { user, token: session.token, sessionId: session.id };
}

/** Another session (another device) for an existing user. */
export async function createSession(userId: string, userAgent?: string) {
  const ctx = await auth.$context;
  const session = await ctx.internalAdapter.createSession(userId, false, userAgent ? { userAgent } : undefined);
  return { token: session.token, sessionId: session.id };
}
