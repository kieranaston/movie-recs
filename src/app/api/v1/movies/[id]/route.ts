import { error, requireUser, parseId } from '@/lib/api';
import { getMovieDetail, getTrailerKey, type TMDBWatchProvider } from '@/lib/tmdb';
import { getWatchlistIds } from '@/lib/watchlist';
import { yearOf } from '@/lib/scoring';

const providers = (list: TMDBWatchProvider[] = []) =>
  [...list]
    .sort((a, b) => a.display_priority - b.display_priority)
    .map((p) => ({ name: p.provider_name, logoPath: p.logo_path }));

/** GET /api/v1/movies/<tmdbId> → full detail for the details screen. */
export async function GET(request: Request, ctx: RouteContext<'/api/v1/movies/[id]'>) {
  const viewer = await requireUser(request);
  if (viewer instanceof Response) return viewer;

  const tmdbId = parseId((await ctx.params).id);
  if (!tmdbId) return error(404, 'Not found');

  try {
    const [movie, saved] = await Promise.all([getMovieDetail(tmdbId), getWatchlistIds(viewer.id)]);
    const ca = movie['watch/providers']?.results.CA;

    return Response.json({
      tmdbId: movie.id,
      title: movie.title,
      tagline: movie.tagline || null,
      overview: movie.overview || null,
      year: yearOf(movie.release_date),
      runtime: movie.runtime || null,
      voteAverage: movie.vote_average ?? null,
      voteCount: movie.vote_count ?? 0,
      genres: (movie.genres ?? []).map((g) => g.name),
      posterPath: movie.poster_path,
      backdropPath: movie.backdrop_path,
      trailerKey: getTrailerKey(movie),
      // Canada, grouped the way the website shows them. Data via JustWatch.
      providers: {
        stream: providers(ca?.flatrate),
        free: providers([...(ca?.free ?? []), ...(ca?.ads ?? [])]),
        rent: providers(ca?.rent),
        buy: providers(ca?.buy),
      },
      inWatchlist: saved.includes(movie.id),
    });
  } catch {
    return error(404, 'Not found');
  }
}
