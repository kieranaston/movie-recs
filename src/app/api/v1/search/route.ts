import { error, requireUser, parseInt0, toApiCard } from '@/lib/api';
import { searchMovies } from '@/lib/tmdb';

/** GET /api/v1/search?q=<text>&page=1 → { movies, page, totalPages } */
export async function GET(request: Request) {
  const viewer = await requireUser(request);
  if (viewer instanceof Response) return viewer;

  const params = new URL(request.url).searchParams;
  const q = params.get('q')?.trim().slice(0, 100) ?? '';
  if (!q) return Response.json({ movies: [], page: 1, totalPages: 0 });

  const page = Math.max(1, parseInt0(params.get('page'), 1, 500));
  try {
    const data = await searchMovies(q, page);
    return Response.json({
      movies: data.results.map((m) =>
        toApiCard({ tmdbId: m.id, title: m.title, releaseDate: m.release_date, posterPath: m.poster_path, voteAverage: m.vote_average })
      ),
      page: data.page,
      totalPages: data.total_pages,
    });
  } catch {
    return error(502, 'Search is unavailable');
  }
}
