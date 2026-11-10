'use server';

import { revalidatePath } from 'next/cache';
import * as W from '@/lib/watchlist';

export async function addToWatchlist(tmdbId: number) {
  await W.addToWatchlist(tmdbId);
  revalidatePath('/watchlist');
}

export async function removeFromWatchlist(tmdbId: number) {
  await W.removeFromWatchlist(tmdbId);
  revalidatePath('/watchlist');
}
