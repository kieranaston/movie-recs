import { Suspense } from 'react';
import { MovieDetails, MovieDetailSkeleton } from '@/components/MovieDetails';
import { MovieModal } from '@/components/MovieModal';

export const dynamic = 'force-dynamic';

/** Intercepts in-app navigation to /movie/[id]: shows the movie in a popup over the current page. */
export default function MovieModalPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <MovieModal>
      <Suspense fallback={<MovieDetailSkeleton />}>
        <MovieDetails params={params} />
      </Suspense>
    </MovieModal>
  );
}
