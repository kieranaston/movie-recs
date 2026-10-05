'use client';

import Image from 'next/image';
import Link from 'next/link';
import { getPosterUrl } from '@/lib/tmdb';
import { TMDBMovie } from '@/lib/tmdb';

interface MovieCardProps {
  movie: TMDBMovie;
}

export function MovieCard({ movie }: MovieCardProps) {
  const posterUrl = getPosterUrl(movie.poster_path, 'w342');
  const year = movie.release_date?.split('-')[0] ?? 'Unknown';

  return (
    <Link
      href={`/movie/${movie.id}`}
      className="group block bg-gray-800 rounded-lg overflow-hidden hover:scale-105 transition-transform duration-200"
      aria-label={`${movie.title} (${year})`}
    >
      <div className="relative aspect-[2/3] overflow-hidden">
        <Image
          src={posterUrl}
          alt={`${movie.title} poster`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
          className="object-cover transition-opacity duration-300 group-hover:opacity-90"
          loading="lazy"
        />
      </div>
      <div className="p-3">
        <h3 className="text-white font-medium truncate">{movie.title}</h3>
        <p className="text-xs text-gray-400">{year} • {movie.vote_average?.toFixed(1) ?? 'N/A'}</p>
      </div>
    </Link>
  );
}

interface MovieGridProps {
  movies: TMDBMovie[];
}

export function MovieGrid({ movies }: MovieGridProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
      {movies.map((movie) => (
        <MovieCard key={movie.id} movie={movie} />
      ))}
    </div>
  );
}

interface MovieCardSkeletonProps {
  count?: number;
}

export function MovieCardSkeleton({ count = 8 }: MovieCardSkeletonProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="aspect-[2/3] rounded-lg bg-gray-800 animate-pulse" />
      ))}
    </div>
  );
}