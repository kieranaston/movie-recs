import { cache } from 'react';
import { desc } from 'drizzle-orm';
import { db } from '@/db';
import { watchlist, type WatchlistItem } from '@/db/schema';

export const getWatchlistIds = cache(async (): Promise<number[]> => {
  const rows = await db.select({ tmdbId: watchlist.tmdbId }).from(watchlist);
  return rows.map((r) => r.tmdbId);
});

export const getWatchlist = cache(async (): Promise<WatchlistItem[]> => {
  return db.select().from(watchlist).orderBy(desc(watchlist.addedAt));
});
