'use server';

import { revalidatePath } from 'next/cache';
import * as Watched from '@/lib/watched';
import { requireOwner } from '@/lib/owner';

export async function setWatched(tmdbId: number, watched: boolean) {
  await requireOwner();
  if (watched) {
    if (!(await Watched.markWatched(tmdbId))) throw new Error('Unknown movie');
  } else {
    await Watched.unmarkWatched(tmdbId);
  }

  revalidatePath('/watched');
  revalidatePath(`/movie/${tmdbId}`);
}

export async function setRating(tmdbId: number, rating: number | null) {
  await requireOwner();
  if (rating !== null && !Watched.isValidRating(rating)) throw new Error('Invalid rating');
  if (!(await Watched.setRating(tmdbId, rating))) throw new Error('Unknown movie');

  revalidatePath('/watched');
  revalidatePath(`/movie/${tmdbId}`);
}
