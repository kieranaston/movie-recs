import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { Calendar, Clock, Star, MapPin, Film, ExternalLink } from 'lucide-react';
import {
  getMovieDetail, getPosterUrl, getBackdropUrl, getProviderLogoUrl, extractYear, getTrailerKey,
  type TMDBMovieDetail,
} from '@/lib/tmdb';
import { WatchlistButton } from '@/components/WatchlistButton';
import { TrailerButton } from '@/components/TrailerButton';
import { getWatchlistIds } from '@/lib/watchlist';
import { getViewer } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface MovieDetailPageProps {
  params: Promise<{ id: string }>;
}

async function MovieContent({ params }: MovieDetailPageProps) {
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

  return (
    <article className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {/* Backdrop */}
    <div className="relative aspect-video rounded-xl overflow-hidden mb-8">
      <Image
        src={getBackdropUrl(movie.backdrop_path, 'w1280')}
        alt={`${movie.title} backdrop`}
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent" />
      <div className="absolute bottom-0 left-0 right-0 p-6 sm:p-8">
        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-2">
          {movie.title}
        </h1>
        <div className="flex flex-wrap items-center gap-4 text-gray-300 text-sm sm:text-base">
          <span className="flex items-center gap-1">
            <Calendar className="h-4 w-4" aria-hidden="true" />
            {year}
          </span>
          {movie.runtime && (
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" aria-hidden="true" />
              {runtime}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" aria-hidden="true" />
            {movie.vote_average?.toFixed(1) ?? 'N/A'} ({movie.vote_count?.toLocaleString() ?? '0'})
          </span>
          {movie.genres && movie.genres.length > 0 && (
            <span className="flex items-center gap-1">
              <Film className="h-4 w-4" aria-hidden="true" />
              {genres}
            </span>
          )}
        </div>
      </div>
    </div>

    <div className="grid lg:grid-cols-3 gap-8">
      {/* Poster & Overview */}
      <div className="lg:col-span-1">
        <div className="sticky top-24">
          <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-800 shadow-xl">
            <Image
              src={getPosterUrl(movie.poster_path, 'w500')}
              alt={`${movie.title} poster`}
              fill
              sizes="(max-width: 1024px) 100vw, 33vw"
              className="object-cover"
            />
          </div>

          <div className="mt-4 flex gap-2">
            {trailerKey && <TrailerButton youtubeKey={trailerKey} title={movie.title} />}
            <WatchlistButton
              tmdbId={movie.id}
              inWatchlist={inWatchlist}
              showLabel
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors"
            />
          </div>

          {movie.homepage && (
            <a
              href={movie.homepage}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 block w-full text-center py-3 bg-primary hover:bg-red-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Official Website
            </a>
          )}

          {movie.imdb_id && (
            <a
              href={`https://www.imdb.com/title/${movie.imdb_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block w-full text-center py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              View on IMDb
            </a>
          )}
        </div>
      </div>

      {/* Details & Streaming */}
      <div className="lg:col-span-2 space-y-8">
        {/* Overview */}
        <section aria-labelledby="overview-heading">
          <h2 id="overview-heading" className="text-2xl font-bold text-white mb-4">
            Overview
          </h2>
          <p className="text-gray-300 leading-relaxed whitespace-pre-line">
            {movie.overview || 'No overview available.'}
          </p>

          {movie.tagline && (
            <blockquote className="mt-6 italic text-gray-400 border-l-4 border-primary pl-4">
              &ldquo;{movie.tagline}&rdquo;
            </blockquote>
          )}

          <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">Original Title</dt>
              <dd className="text-white font-medium">{movie.original_title}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Original Language</dt>
              <dd className="text-white font-medium capitalize">{movie.original_language}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Status</dt>
              <dd className="text-white font-medium capitalize">{movie.status}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Release Date</dt>
              <dd className="text-white font-medium">{movie.release_date}</dd>
            </div>
            {movie.runtime && (
              <div>
                <dt className="text-gray-500">Runtime</dt>
                <dd className="text-white font-medium">{runtime}</dd>
              </div>
            )}
            <div>
              <dt className="text-gray-500">Genres</dt>
              <dd className="text-white font-medium">{genres}</dd>
            </div>
          </dl>
        </section>

        {/* Streaming Providers */}
        <section aria-labelledby="streaming-heading">
          <h2 id="streaming-heading" className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" aria-hidden="true" />
            Where to Watch in Canada
          </h2>

          {(!flatrateProviders.length && !rentProviders.length && !buyProviders.length && !freeProviders.length && !adsProviders.length) ? (
            <div className="bg-gray-800/50 rounded-lg p-6 text-center">
              <p className="text-gray-400">
                No streaming availability information available for Canada.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {flatrateProviders.length > 0 && (
                <ProviderGroup
                  title="Streaming (Subscription)"
                  providers={flatrateProviders}
                  iconColor="text-green-400"
                />
              )}
              {freeProviders.length > 0 && (
                <ProviderGroup
                  title="Free"
                  providers={freeProviders}
                  iconColor="text-blue-400"
                />
              )}
              {adsProviders.length > 0 && (
                <ProviderGroup
                  title="Free with Ads"
                  providers={adsProviders}
                  iconColor="text-blue-400"
                />
              )}
              {rentProviders.length > 0 && (
                <ProviderGroup
                  title="Rent"
                  providers={rentProviders}
                  iconColor="text-orange-400"
                />
              )}
              {buyProviders.length > 0 && (
                <ProviderGroup
                  title="Buy"
                  providers={buyProviders}
                  iconColor="text-purple-400"
                />
              )}
            </div>
          )}

          <p className="mt-6 text-xs text-gray-500 text-center">
            Streaming availability data provided by{' '}
            <a
              href="https://www.justwatch.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              JustWatch
            </a>
            .
          </p>
        </section>
      </div>
    </div>

    {/* TODO: Add recommendations section here */}
    {/* <section className="mt-16">
      <h2 className="text-2xl font-bold text-white mb-6">Similar Movies</h2>
      <MovieCard movies={similarMovies} />
    </section> */}
  </article>
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

function MovieDetailSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="relative aspect-video rounded-xl bg-gray-800 animate-pulse mb-8" />
      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <div className="aspect-[2/3] rounded-lg bg-gray-800 animate-pulse" />
        </div>
        <div className="lg:col-span-2 space-y-8">
          <div>
            <div className="h-8 w-32 bg-gray-800 animate-pulse rounded mb-4" />
            <div className="h-4 w-full bg-gray-800 animate-pulse rounded mb-2" />
            <div className="h-4 w-3/4 bg-gray-800 animate-pulse rounded" />
          </div>
          <div>
            <div className="h-8 w-48 bg-gray-800 animate-pulse rounded mb-3" />
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 w-24 bg-gray-800 animate-pulse rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default async function MovieDetailPage({ params }: MovieDetailPageProps) {
  return (
    <Suspense fallback={<MovieDetailSkeleton />}>
      <MovieContent params={params} />
    </Suspense>
  );
}