import { cache } from 'react';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { movies, userWatchlist, type WatchlistItem } from '@/db/schema';
import { getMovieDetail } from './tmdb';

// Every function takes the owner's user id: a watchlist is only ever read or written for one user.

export const getWatchlistIds = cache(async (userId: string): Promise<number[]> => {
  const rows = await db.select({ tmdbId: userWatchlist.tmdbId }).from(userWatchlist).where(eq(userWatchlist.userId, userId));
  return rows.map((r) => r.tmdbId);
});

export const getWatchlist = cache(async (userId: string): Promise<WatchlistItem[]> => {
  return db.select().from(userWatchlist).where(eq(userWatchlist.userId, userId)).orderBy(desc(userWatchlist.addedAt));
});

export function isValidTmdbId(id: unknown): id is number {
  return typeof id === 'number' && Number.isSafeInteger(id) && id > 0;
}

export interface MovieSnapshot {
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  voteAverage: number | null;
}

/**
 * The metadata stored alongside a saved title, from our catalog (or TMDB as a fallback),
 * never from the caller. Null if the id isn't a real movie.
 */
export async function movieSnapshot(tmdbId: number): Promise<MovieSnapshot | null> {
  const [row] = await db
    .select({ title: movies.title, posterPath: movies.posterPath, releaseDate: movies.releaseDate, voteAverage: movies.voteAverage })
    .from(movies)
    .where(eq(movies.tmdbId, tmdbId))
    .limit(1);
  if (row) return row;

  return getMovieDetail(tmdbId)
    .then((m) => ({ title: m.title, posterPath: m.poster_path, releaseDate: m.release_date || null, voteAverage: m.vote_average }))
    .catch(() => null);
}

/**
 * Save a title by id. Metadata comes from our catalog (or TMDB as a fallback),
 * never from the caller. Idempotent. Returns false if the id isn't a real movie.
 */
export async function addToWatchlist(userId: string, tmdbId: number): Promise<boolean> {
  if (!isValidTmdbId(tmdbId)) return false;

  const item = await movieSnapshot(tmdbId);
  if (!item) return false;

  await db
    .insert(userWatchlist)
    .values({ userId, tmdbId, ...item })
    .onConflictDoNothing({ target: [userWatchlist.userId, userWatchlist.tmdbId] });
  return true;
}

/** Idempotent. */
export async function removeFromWatchlist(userId: string, tmdbId: number): Promise<void> {
  if (!isValidTmdbId(tmdbId)) return;
  await db.delete(userWatchlist).where(and(eq(userWatchlist.userId, userId), eq(userWatchlist.tmdbId, tmdbId)));
}
