import { MovieDetailSkeleton } from '@/components/MovieDetails';

// Prefetched with the poster links, so the popup (with this placeholder) appears without waiting on the server.
export default function Loading() {
  return <MovieDetailSkeleton />;
}
