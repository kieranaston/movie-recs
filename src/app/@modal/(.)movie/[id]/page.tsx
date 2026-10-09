import { MovieDetails } from '@/components/MovieDetails';

export const dynamic = 'force-dynamic';

/** Intercepts in-app navigation to /movie/[id]: shows the movie in a popup over the current page. */
export default function MovieModalPage({ params }: { params: Promise<{ id: string }> }) {
  return <MovieDetails params={params} />;
}
