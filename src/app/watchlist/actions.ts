'use server';

import { revalidatePath } from 'next/cache';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { watchlist } from '@/db/schema';

export interface WatchlistInput {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  releaseDate: string | null;
  voteAverage: number | null;
}

export async function addToWatchlist(item: WatchlistInput) {
  await db
    .insert(watchlist)
    .values({
      tmdbId: item.tmdbId,
      title: item.title,
      posterPath: item.posterPath,
      releaseDate: item.releaseDate,
      voteAverage: item.voteAverage,
    })
    .onConflictDoNothing({ target: watchlist.tmdbId });
  revalidatePath('/watchlist');
}

export async function removeFromWatchlist(tmdbId: number) {
  await db.delete(watchlist).where(eq(watchlist.tmdbId, tmdbId));
  revalidatePath('/watchlist');
}
