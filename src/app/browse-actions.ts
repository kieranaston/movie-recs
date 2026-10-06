'use server';

import { getSectionMovies, type CardMovie } from '@/lib/browse';
import { SECTIONS, type SectionId } from '@/lib/taxonomy';

export async function loadMoreSection(input: {
  genreId?: number;
  sectionId: SectionId;
  offset: number;
  limit?: number;
}): Promise<{ movies: CardMovie[]; total: number }> {
  // Server actions are public endpoints: validate everything the client sends.
  const { genreId, sectionId, offset, limit = 20 } = input;
  if (!SECTIONS.some((s) => s.id === sectionId)) return { movies: [], total: 0 };
  const int = (n: unknown, max: number) => (Number.isInteger(n) ? Math.min(Math.max(n as number, 0), max) : 0);
  return getSectionMovies({
    genreId: Number.isInteger(genreId) ? genreId : undefined,
    sectionId,
    offset: int(offset, 10_000),
    limit: int(limit, 50) || 20,
  });
}
