import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getViewer } from '@/lib/auth';
import { getWatchlist } from '@/lib/watchlist';
import { getPosterUrl, extractYear } from '@/lib/tmdb';
import { WatchlistButton } from '@/components/WatchlistButton';

export const dynamic = 'force-dynamic';

export default async function WatchlistPage() {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent('/watchlist')}`);
  const items = await getWatchlist(viewer.id);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-bold text-white mb-6">Watchlist</h1>
      {items.length === 0 ? (
        <p className="text-gray-400">Nothing saved yet — tap the bookmark on any film to add it.</p>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-3">
          {items.map((m) => (
            <div key={m.id} className="group relative">
              <Link href={`/movie/${m.tmdbId}`} className="block">
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
                  <p className="text-xs text-gray-400">
                    {extractYear(m.releaseDate ?? '')}
                    {m.voteAverage != null ? ` · ${m.voteAverage.toFixed(1)}` : ''}
                  </p>
                </div>
              </Link>
              <WatchlistButton
                tmdbId={m.tmdbId}
                inWatchlist
                className="absolute top-1.5 right-1.5 p-1.5 rounded-full bg-black/55 hover:bg-black/80 text-white"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
