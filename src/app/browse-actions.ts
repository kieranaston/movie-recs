'use server';

import { getSectionMovies, type CardMovie } from '@/lib/browse';
import type { SectionId } from '@/lib/taxonomy';

export async function loadMoreSection(input: {
  genreId?: number;
  sectionId: SectionId;
  offset: number;
  limit?: number;
}): Promise<{ movies: CardMovie[]; total: number }> {
  return getSectionMovies(input);
}
