'use server';

import { revalidatePath } from 'next/cache';
import { getViewer } from '@/lib/auth';
import * as Watched from '@/lib/watched';

// Server actions are public endpoints — authorize inside each one, not just in the UI.

export async function setWatched(tmdbId: number, watched: boolean) {
  const viewer = await getViewer();
  if (!viewer) throw new Error('Unauthorized');

  if (watched) {
    if (!(await Watched.markWatched(viewer.id, tmdbId))) throw new Error('Unknown movie');
  } else {
    await Watched.unmarkWatched(viewer.id, tmdbId);
  }

  revalidatePath('/watched');
  revalidatePath(`/movie/${tmdbId}`);
}

export async function setRating(tmdbId: number, rating: number | null) {
  const viewer = await getViewer();
  if (!viewer) throw new Error('Unauthorized');
  if (rating !== null && !Watched.isValidRating(rating)) throw new Error('Invalid rating');
  if (!(await Watched.setRating(viewer.id, tmdbId, rating))) throw new Error('Unknown movie');

  revalidatePath('/watched');
  revalidatePath(`/movie/${tmdbId}`);
}
