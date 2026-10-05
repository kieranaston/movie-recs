'use client';

import Image from 'next/image';
import Link from 'next/link';
import { getPosterUrl } from '@/lib/tmdb';
import type { CardMovie } from '@/lib/browse';
import { WatchlistButton } from './WatchlistButton';

export function CatalogMovieCard({ movie, inWatchlist = false }: { movie: CardMovie; inWatchlist?: boolean }) {
  const year = movie.year ?? '—';
  return (
    <div className="group relative">
      <Link href={`/movie/${movie.tmdbId}`} className="block" aria-label={`${movie.title} (${year})`}>
        <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-800">
          <Image
            src={getPosterUrl(movie.posterPath, 'w342')}
            alt={`${movie.title} poster`}
            fill
            sizes="150px"
            className="object-cover transition-opacity duration-300 group-hover:opacity-90"
            loading="lazy"
          />
        </div>
        <div className="mt-2">
          <h3 className="text-sm font-medium text-white truncate group-hover:text-primary transition-colors">
            {movie.title}
          </h3>
          <p className="text-xs text-gray-400">
            {year} · <span className="text-gray-300">{movie.voteAverage.toFixed(1)}</span>
          </p>
        </div>
      </Link>
      <WatchlistButton
        movie={{
          tmdbId: movie.tmdbId,
          title: movie.title,
          posterPath: movie.posterPath,
          releaseDate: movie.releaseDate,
          voteAverage: movie.voteAverage,
        }}
        inWatchlist={inWatchlist}
        className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/55 text-white hover:bg-black/80 backdrop-blur-sm"
      />
    </div>
  );
}
