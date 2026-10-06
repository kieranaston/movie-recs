import { error, requireUser, parseGenre, parseInt0, toApiCard } from '@/lib/api';
import { getSectionMovies } from '@/lib/browse';
import { SECTIONS, type SectionId } from '@/lib/taxonomy';

/** GET /api/v1/browse/section?section=<id>&genre=<slug>&offset=20&limit=20 → { movies, total } */
export async function GET(request: Request) {
  const viewer = await requireUser(request);
  if (viewer instanceof Response) return viewer;

  const params = new URL(request.url).searchParams;
  const sectionId = params.get('section') as SectionId | null;
  if (!SECTIONS.some((s) => s.id === sectionId)) return error(404, 'Unknown section');

  const genre = parseGenre(params.get('genre'));
  if (genre === null) return error(404, 'Unknown genre');

  const { movies, total } = await getSectionMovies({
    genreId: genre?.tmdbId,
    sectionId: sectionId as SectionId,
    offset: parseInt0(params.get('offset'), 0, 100_000),
    limit: parseInt0(params.get('limit'), 20, 50) || 20,
  });
  return Response.json({ movies: movies.map(toApiCard), total });
}
