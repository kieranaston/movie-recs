'use client';

import Image from 'next/image';
import Link from 'next/link';
import { getPosterUrl } from '@/lib/tmdb';
import type { CardMovie } from '@/lib/browse';
import { WatchlistButton } from './WatchlistButton';

/**
 * Poster card. Hover (mouse) or keyboard focus lifts it: a slight zoom, plus a shadow and outline that
 * fade in. Only scale and opacity animate (the browser promotes them
 * to GPU layers just for the animation — no permanent will-change layers per card), so it stays smooth.
 * `hover:` only applies on devices that can hover. Clicking opens the movie straight away (no press
 * animation). Respects "reduce motion".
 */
export function CatalogMovieCard({ movie, inWatchlist = false }: { movie: CardMovie; inWatchlist?: boolean }) {
  const year = movie.year ?? '—';
  return (
    <div
      className={[
        // Tailwind v4's scale-* sets the CSS `scale` property (not `transform`), so that's what we transition.
        'group relative transition-[scale] duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]',
        'hover:z-10 hover:scale-[1.06] has-[:focus-visible]:z-10 has-[:focus-visible]:scale-[1.06]',
        'motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:has-[:focus-visible]:scale-100',
      ].join(' ')}
    >
      <Link href={`/movie/${movie.tmdbId}`} scroll={false} className="block outline-none" aria-label={`${movie.title} (${year})`}>
        <div
          className={[
            'relative aspect-[2/3] rounded-lg bg-gray-800',
            // Shadow + outline live on a separate layer whose opacity fades (cheaper than animating shadows).
            'after:pointer-events-none after:absolute after:inset-0 after:rounded-lg after:opacity-0',
            'after:shadow-[0_18px_40px_-10px_rgba(0,0,0,0.85)] after:ring-2 after:ring-white/80',
            'after:transition-opacity after:duration-200 group-hover:after:opacity-100 group-has-[:focus-visible]:after:opacity-100',
          ].join(' ')}
        >
          <div className="absolute inset-0 overflow-hidden rounded-lg">
            <Image
              src={getPosterUrl(movie.posterPath, 'w342')}
              alt={`${movie.title} poster`}
              fill
              sizes="(min-width: 1280px) 180px, (min-width: 768px) 20vw, 33vw"
              className="object-cover"
              loading="lazy"
            />
          </div>
        </div>
        <div className="mt-2">
          <h3 className="truncate text-sm font-medium text-gray-200 group-hover:text-white">{movie.title}</h3>
          <p className="text-xs text-gray-400">
            {year} · <span className="text-gray-300">{movie.voteAverage.toFixed(1)}</span>
          </p>
        </div>
      </Link>
      <WatchlistButton
        tmdbId={movie.tmdbId}
        inWatchlist={inWatchlist}
        className="absolute right-1.5 top-1.5 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/85"
      />
    </div>
  );
}
