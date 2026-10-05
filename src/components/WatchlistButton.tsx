'use client';

import { useState, useTransition } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { addToWatchlist, removeFromWatchlist, type WatchlistInput } from '@/app/watchlist/actions';

export function WatchlistButton({
  movie,
  inWatchlist,
  className = '',
  showLabel = false,
}: {
  movie: WatchlistInput;
  inWatchlist: boolean;
  className?: string;
  showLabel?: boolean;
}) {
  const [saved, setSaved] = useState(inWatchlist);
  const [pending, startTransition] = useTransition();

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !saved;
    setSaved(next);
    startTransition(async () => {
      if (next) await addToWatchlist(movie);
      else await removeFromWatchlist(movie.tmdbId);
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? 'Remove from watchlist' : 'Add to watchlist'}
      className={className}
    >
      {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
      {showLabel && <span>{saved ? 'In Watchlist' : 'Watchlist'}</span>}
    </button>
  );
}
