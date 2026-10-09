import { Suspense } from 'react';
import { MovieDetails, MovieDetailSkeleton } from '@/components/MovieDetails';

export const dynamic = 'force-dynamic';

/** Full page for a movie (direct visits, shared links, reloads). In-app clicks open it as a popup instead. */
export default async function MovieDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<MovieDetailSkeleton />}>
      <MovieDetails params={params} />
    </Suspense>
  );
}
