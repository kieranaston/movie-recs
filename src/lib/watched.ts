import { cache } from 'react';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { userWatched, type WatchedItem } from '@/db/schema';
import { isValidTmdbId, movieSnapshot } from './watchlist';

/** Personal rating scale: TMDB's 0–10, one decimal. 0 means "unrated" on TMDB, so 0.5 is the floor. */
export const MIN_RATING = 0.5;
export const MAX_RATING = 10;

/** A whole tenth within [MIN_RATING, MAX_RATING] — tolerant of float rounding, rejects 7.85 and 11. */
export function isValidRating(value: unknown): value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return false;
  if (value < MIN_RATING || value > MAX_RATING) return false;
  return Math.abs(value * 10 - Math.round(value * 10)) < 1e-6;
}

export const getWatched = cache(async (): Promise<WatchedItem[]> => {
  return db.select().from(userWatched).orderBy(desc(userWatched.watchedAt));
});

/** tmdbId → rating (null when watched but unrated), for a single movie page. */
export const getWatchedRatings = cache(async (): Promise<Map<number, number | null>> => {
  const rows = await db.select({ tmdbId: userWatched.tmdbId, rating: userWatched.rating }).from(userWatched);
  return new Map(rows.map((r) => [r.tmdbId, r.rating]));
});

/** Mark watched, snapshotting the title. Idempotent. Returns false if the id isn't a real movie. */
export async function markWatched(tmdbId: number): Promise<boolean> {
  if (!isValidTmdbId(tmdbId)) return false;

  const item = await movieSnapshot(tmdbId);
  if (!item) return false;

  await db
    .insert(userWatched)
    .values({ tmdbId, ...item })
    .onConflictDoNothing({ target: userWatched.tmdbId });
  return true;
}

/** Un-watched: the row (and any rating) is removed. Idempotent. */
export async function unmarkWatched(tmdbId: number): Promise<void> {
  if (!isValidTmdbId(tmdbId)) return;
  await db.delete(userWatched).where(eq(userWatched.tmdbId, tmdbId));
}

/** Set or clear a rating, marking the title watched first. Returns false for an unknown id or a bad rating. */
export async function setRating(tmdbId: number, rating: number | null): Promise<boolean> {
  if (rating !== null && !isValidRating(rating)) return false;
  if (!(await markWatched(tmdbId))) return false;

  await db.update(userWatched).set({ rating }).where(eq(userWatched.tmdbId, tmdbId));
  return true;
}
