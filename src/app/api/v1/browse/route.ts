import { error, requireUser, parseGenre, parseInt0, toApiCard } from '@/lib/api';
import { getBrowsePage } from '@/lib/browse';

/**
 * GET /api/v1/browse?genre=<slug>&filter=<label>&limit=20&offset=0
 * No filter → { mode: 'sections', sections: [{ id, label, total, movies }] }
 * Filter    → { mode: 'list', movies, total } (paged with offset/limit)
 */
export async function GET(request: Request) {
  const viewer = await requireUser(request);
  if (viewer instanceof Response) return viewer;

  const params = new URL(request.url).searchParams;
  const genre = parseGenre(params.get('genre'));
  if (genre === null) return error(404, 'Unknown genre');

  const filterLabel = params.get('filter');
  const filter = filterLabel ? genre?.filters.find((f) => f.label === filterLabel) : undefined;
  if (filterLabel && !filter) return error(404, 'Unknown filter');

  const limit = parseInt0(params.get('limit'), 20, 50) || 20;
  const result = await getBrowsePage({ genreId: genre?.tmdbId, filter, limit });

  if (result.mode === 'list') {
    const offset = parseInt0(params.get('offset'), 0, 100_000);
    return Response.json({
      mode: 'list',
      movies: result.movies.slice(offset, offset + limit).map(toApiCard),
      total: result.total,
    });
  }

  return Response.json({
    mode: 'sections',
    sections: result.sections
      .filter((s) => s.movies.length > 0)
      .map((s) => ({ id: s.id, label: s.label, total: s.total, movies: s.movies.map(toApiCard) })),
  });
}
