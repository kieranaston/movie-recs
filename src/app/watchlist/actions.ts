'use server';

import { revalidatePath } from 'next/cache';
import * as W from '@/lib/watchlist';
import { requireOwner } from '@/lib/owner';

export async function addToWatchlist(tmdbId: number) {
  await requireOwner();
  await W.addToWatchlist(tmdbId);
  revalidatePath('/watchlist');
}

export async function removeFromWatchlist(tmdbId: number) {
  await requireOwner();
  await W.removeFromWatchlist(tmdbId);
  revalidatePath('/watchlist');
}
