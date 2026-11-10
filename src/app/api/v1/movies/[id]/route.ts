import { error, guard, parseId } from '@/lib/api';
import { getMovieDetail, getTrailerKey } from '@/lib/tmdb';
import { getWatchlistIds } from '@/lib/watchlist';
import { yearOf } from '@/lib/scoring';

/** GET /api/v1/movies/<tmdbId> → full detail for the details screen. */
export async function GET(request: Request, ctx: RouteContext<'/api/v1/movies/[id]'>) {
  const denied = await guard(request);
  if (denied) return denied;

  const tmdbId = parseId((await ctx.params).id);
  if (!tmdbId) return error(404, 'Not found');

  try {
    const [movie, saved] = await Promise.all([getMovieDetail(tmdbId), getWatchlistIds()]);

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
      directors: (movie.credits?.crew ?? []).filter((c) => c.job === 'Director').map((c) => c.name),
      cast: [...(movie.credits?.cast ?? [])]
        .sort((a, b) => a.order - b.order)
        .slice(0, 15)
        .map((c) => ({ name: c.name, character: c.character || null, profilePath: c.profile_path })),
      inWatchlist: saved.includes(movie.id),
    });
  } catch {
    return error(404, 'Not found');
  }
}
