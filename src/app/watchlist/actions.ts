'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth';
import * as W from '@/lib/watchlist';

// Server actions are public endpoints — authorize inside each one, not just in the UI.

export async function addToWatchlist(tmdbId: number) {
  const viewer = await getViewer();
  if (!viewer) throw new Error('Unauthorized');
  await W.addToWatchlist(viewer.id, tmdbId);
  revalidatePath('/watchlist');
}

export async function removeFromWatchlist(tmdbId: number) {
  const viewer = await getViewer();
  if (!viewer) throw new Error('Unauthorized');
  await W.removeFromWatchlist(viewer.id, tmdbId);
  revalidatePath('/watchlist');
}
