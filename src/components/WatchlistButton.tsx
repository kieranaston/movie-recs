'use client';

import { useState, useTransition } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { addToWatchlist, removeFromWatchlist } from '@/app/watchlist/actions';
import { useViewer } from './ViewerProvider';

export function WatchlistButton({
  tmdbId,
  inWatchlist,
  className = '',
  showLabel = false,
}: {
  tmdbId: number;
  inWatchlist: boolean;
  className?: string;
  showLabel?: boolean;
}) {
  const viewer = useViewer();
  const [saved, setSaved] = useState(inWatchlist);
  const [pending, startTransition] = useTransition();

  if (!viewer) return null;

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !saved;
    setSaved(next);
    startTransition(async () => {
      try {
        if (next) await addToWatchlist(tmdbId);
        else await removeFromWatchlist(tmdbId);
      } catch {
        setSaved(!next); // roll back the optimistic toggle
      }
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
