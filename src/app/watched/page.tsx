import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Star } from 'lucide-react';
import { getViewer } from '@/lib/auth';
import { getWatched } from '@/lib/watched';
import { getPosterUrl, extractYear } from '@/lib/tmdb';

export const dynamic = 'force-dynamic';

export default async function WatchedPage() {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent('/watched')}`);
  const items = await getWatched(viewer.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
      <h1 className="sr-only">Watched</h1>
      {items.length === 0 ? (
        <p className="text-gray-400">Nothing watched yet — open a film and mark it as watched.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-3">
          {items.map((m) => (
            <div key={m.id} className="group relative">
              <Link href={`/movie/${m.tmdbId}`} scroll={false} className="block">
                <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-gray-800">
                  <Image
                    src={getPosterUrl(m.posterPath, 'w342')}
                    alt={`${m.title} poster`}
                    fill
                    sizes="150px"
                    className="object-cover group-hover:opacity-90 transition-opacity"
                  />
                </div>
                <div className="mt-2">
                  <h3 className="text-sm font-medium text-white truncate">{m.title}</h3>
                  <p className="text-xs text-gray-400">{extractYear(m.releaseDate ?? '')}</p>
                  <Rating rating={m.rating} />
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** The saved rating (TMDB's 0–10), or a quiet "Not rated". */
function Rating({ rating }: { rating: number | null }) {
  if (rating == null) return <p className="mt-0.5 text-xs text-gray-500">Not rated</p>;
  return (
    <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-300">
      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" aria-hidden="true" />
      {rating.toFixed(1)}
      <span className="text-gray-500">/10</span>
    </p>
  );
}
