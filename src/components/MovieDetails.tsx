import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Calendar, Clock, Star, MapPin, Film, ExternalLink, User } from 'lucide-react';
import {
  getMovieDetail, getPosterUrl, getBackdropUrl, getProviderLogoUrl, getProfileUrl, extractYear, getTrailerKey,
  type TMDBCastMember, type TMDBMovieDetail,
} from '@/lib/tmdb';
import { WatchlistButton } from '@/components/WatchlistButton';
import { TrailerButton } from '@/components/TrailerButton';
import { getWatchlistIds } from '@/lib/watchlist';
import { getViewer } from '@/lib/auth';

/**
 * A movie's details. Rendered as the full /movie/[id] page and inside the popup that opens over
 * lists (app/@modal/(.)movie/[id]), so both look the same.
 */
export async function MovieDetails({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const movieId = parseInt(id, 10);

  if (isNaN(movieId)) {
    notFound();
  }

  let movie: TMDBMovieDetail;
  try {
    movie = await getMovieDetail(movieId);
  } catch {
    return (
      <article className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12 text-gray-400">
          <p>Unable to load movie details.</p>
          <p className="text-sm mt-1">Please try again later.</p>
        </div>
      </article>
    );
  }

  const trailerKey = getTrailerKey(movie);
  const viewer = await getViewer();
  const inWatchlist = viewer ? (await getWatchlistIds(viewer.id)).includes(movieId) : false;

  const caProviders = movie['watch/providers']?.results.CA;
  const flatrateProviders = caProviders?.flatrate ?? [];
  const rentProviders = caProviders?.rent ?? [];
  const buyProviders = caProviders?.buy ?? [];
  const freeProviders = caProviders?.free ?? [];
  const adsProviders = caProviders?.ads ?? [];

  const genres = movie.genres?.map((g) => g.name).join(', ') ?? 'N/A';
  const year = extractYear(movie.release_date);
  const runtime = movie.runtime ? `${movie.runtime} min` : 'N/A';

  const cast = [...(movie.credits?.cast ?? [])].sort((a, b) => a.order - b.order).slice(0, 15);
  const directors = (movie.credits?.crew ?? []).filter((c) => c.job === 'Director').map((c) => c.name);
  const hasProviders = [flatrateProviders, rentProviders, buyProviders, freeProviders, adsProviders].some((p) => p.length > 0);

  return (
    <article className="relative mx-auto max-w-6xl">
      {/* A short, faded backdrop behind the header — the useful info starts on the first screen. */}
      <div className="absolute inset-x-0 top-0 h-56 overflow-hidden sm:h-72 sm:rounded-t-2xl" aria-hidden="true">
        <Image
          src={getBackdropUrl(movie.backdrop_path, 'w1280')}
          alt=""
          fill
          priority
          sizes="(min-width: 1152px) 1152px, 100vw"
          className="object-cover opacity-50"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/60 to-transparent" />
      </div>

      <div className="relative px-4 pb-8 pt-20 sm:px-8 sm:pt-28">
        {/* Header: poster beside title and facts; actions under the title (own full-width line on phones). */}
        <div className="grid grid-cols-[auto_1fr] items-end gap-x-4 gap-y-4 sm:gap-x-8">
          <div className="relative aspect-[2/3] w-28 shrink-0 self-end sm:row-span-2 overflow-hidden rounded-lg bg-gray-800 shadow-2xl sm:w-44 lg:w-52">
            <Image
              src={getPosterUrl(movie.poster_path, 'w500')}
              alt={`${movie.title} poster`}
              fill
              priority
              sizes="(min-width: 1024px) 208px, (min-width: 640px) 176px, 112px"
              className="object-cover"
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white sm:text-4xl">{movie.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-300">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" aria-hidden="true" />
                {year}
              </span>
              {movie.runtime ? (
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  {runtime}
                </span>
              ) : null}
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" aria-hidden="true" />
                {movie.vote_average?.toFixed(1) ?? 'N/A'} ({movie.vote_count?.toLocaleString() ?? '0'})
              </span>
              {movie.genres && movie.genres.length > 0 && (
                <span className="hidden items-center gap-1 sm:flex">
                  <Film className="h-4 w-4" aria-hidden="true" />
                  {genres}
                </span>
              )}
            </div>
          </div>
          <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:col-start-2 sm:self-start">
            <Actions movie={movie} trailerKey={trailerKey} inWatchlist={inWatchlist} />
          </div>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <section aria-labelledby="overview-heading">
              <h2 id="overview-heading" className="sr-only">Overview</h2>
              {movie.tagline && <p className="mb-3 italic text-gray-400">&ldquo;{movie.tagline}&rdquo;</p>}
              <p className="leading-relaxed text-gray-200 whitespace-pre-line">{movie.overview || 'No overview available.'}</p>
              {directors.length > 0 && (
                <p className="mt-3 text-sm text-gray-400">
                  Directed by <span className="text-gray-200">{directors.join(', ')}</span>
                </p>
              )}
            </section>

            {cast.length > 0 && <CastList cast={cast} />}

            <section aria-labelledby="streaming-heading">
              <h2 id="streaming-heading" className="mb-4 flex items-center gap-2 text-xl font-bold text-white">
                <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
                Where to Watch in Canada
              </h2>
              {!hasProviders ? (
                <p className="rounded-lg bg-gray-800/50 p-4 text-gray-400">No streaming availability information available for Canada.</p>
              ) : (
                <div className="space-y-5">
                  {flatrateProviders.length > 0 && <ProviderGroup title="Streaming (Subscription)" providers={flatrateProviders} iconColor="text-green-400" />}
                  {freeProviders.length > 0 && <ProviderGroup title="Free" providers={freeProviders} iconColor="text-blue-400" />}
                  {adsProviders.length > 0 && <ProviderGroup title="Free with Ads" providers={adsProviders} iconColor="text-blue-400" />}
                  {rentProviders.length > 0 && <ProviderGroup title="Rent" providers={rentProviders} iconColor="text-orange-400" />}
                  {buyProviders.length > 0 && <ProviderGroup title="Buy" providers={buyProviders} iconColor="text-purple-400" />}
                </div>
              )}
              <p className="mt-4 text-xs text-gray-500">
                Streaming availability data provided by{' '}
                <a href="https://www.justwatch.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  JustWatch
                </a>
                .
              </p>
            </section>
          </div>

          <aside className="space-y-4">
            <dl className="grid grid-cols-2 gap-4 text-sm lg:grid-cols-1">
              <div>
                <dt className="text-gray-500">Original Title</dt>
                <dd className="font-medium text-white">{movie.original_title}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Original Language</dt>
                <dd className="font-medium capitalize text-white">{movie.original_language}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Release Date</dt>
                <dd className="font-medium text-white">{movie.release_date}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Genres</dt>
                <dd className="font-medium text-white">{genres}</dd>
              </div>
            </dl>
            <div className="flex flex-col gap-2">
              {movie.imdb_id && (
                <a
                  href={`https://www.imdb.com/title/${movie.imdb_id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-lg bg-gray-800 py-2.5 font-medium text-white transition-colors hover:bg-gray-700"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  View on IMDb
                </a>
              )}
              {movie.homepage && (
                <a
                  href={movie.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-lg bg-gray-800 py-2.5 font-medium text-white transition-colors hover:bg-gray-700"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Official Website
                </a>
              )}
            </div>
          </aside>
        </div>
      </div>
    </article>
  );
}

/** Top-billed cast as a scrollable strip of headshots. */
function CastList({ cast }: { cast: TMDBCastMember[] }) {
  return (
    <section aria-labelledby="cast-heading">
      <h2 id="cast-heading" className="mb-4 text-xl font-bold text-white">Cast</h2>
      <ul className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:thin]">
        {cast.map((p) => {
          const photo = getProfileUrl(p.profile_path);
          return (
            <li key={`${p.id}-${p.character}`} className="w-24 shrink-0 snap-start sm:w-28">
              <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-gray-800">
                {photo ? (
                  <Image src={photo} alt="" fill sizes="112px" className="object-cover" loading="lazy" />
                ) : (
                  <User className="absolute inset-0 m-auto h-8 w-8 text-gray-600" aria-hidden="true" />
                )}
              </div>
              <p className="mt-2 line-clamp-2 text-sm font-medium leading-tight text-white">{p.name}</p>
              {p.character && <p className="mt-0.5 line-clamp-2 text-xs leading-tight text-gray-400">{p.character}</p>}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Actions({ movie, trailerKey, inWatchlist }: { movie: TMDBMovieDetail; trailerKey: string | null; inWatchlist: boolean }) {
  return (
    <>
      {trailerKey && <TrailerButton youtubeKey={trailerKey} title={movie.title} />}
      <WatchlistButton
        tmdbId={movie.id}
        inWatchlist={inWatchlist}
        showLabel
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 font-medium text-white transition-colors hover:bg-red-700 aria-pressed:bg-gray-800 aria-pressed:hover:bg-gray-700"
      />
    </>
  );
}

function ProviderGroup({
  title,
  providers,
  iconColor,
}: {
  title: string;
  providers: Array<{ provider_name: string; logo_path: string; display_priority: number }>;
  iconColor: string;
}) {
  const sortedProviders = [...providers].sort((a, b) => a.display_priority - b.display_priority);

  return (
    <div>
      <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${iconColor}`} aria-hidden="true" />
        {title}
      </h3>
      <div className="flex flex-wrap gap-3">
        {sortedProviders.map((provider) => (
          <a
            key={provider.provider_name}
            href={`https://www.justwatch.com/ca/provider/${provider.provider_name.toLowerCase().replace(/\s+/g, '-')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg hover:bg-gray-800 transition-colors group"
            aria-label={`${provider.provider_name} (${title})`}
          >
            <Image
              src={getProviderLogoUrl(provider.logo_path)}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 object-contain transition-opacity"
              loading="lazy"
            />
            <span className="text-sm font-medium text-white group-hover:text-primary transition-colors">
              {provider.provider_name}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

/** Placeholder with the same shape as the details, shown while they load. Static: no pulsing. */
export function MovieDetailSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-8 pt-20 sm:px-8 sm:pt-28" aria-busy="true" aria-label="Loading movie">
      <div className="flex items-end gap-4 sm:gap-8">
        <div className="aspect-[2/3] w-28 shrink-0 rounded-lg bg-gray-800 sm:w-44 lg:w-52" />
        <div className="flex-1 space-y-3">
          <div className="h-8 w-2/3 rounded bg-gray-800" />
          <div className="h-4 w-1/2 rounded bg-gray-800/70" />
        </div>
      </div>
      <div className="mt-8 max-w-2xl space-y-2">
        <div className="h-4 w-full rounded bg-gray-800/70" />
        <div className="h-4 w-full rounded bg-gray-800/70" />
        <div className="h-4 w-3/4 rounded bg-gray-800/70" />
      </div>
    </div>
  );
}
