'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, Eye, X } from 'lucide-react';
import { setRating, setWatched } from '@/app/watched/actions';
import { useViewer } from './ViewerProvider';

// Matches the server's scale (src/lib/watched.ts): TMDB's 0–10. 0 = unrated, so 0.5 is the floor.
const MIN = 0.5;
const MAX = 10;
const DEFAULT = 5; // where the rating starts while the title is unrated

const BUTTON =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-gray-800 px-4 py-2.5 font-medium text-white transition-colors hover:bg-gray-700 aria-pressed:bg-gray-700 aria-pressed:hover:bg-gray-600';
const STEP_BUTTON =
  'inline-flex h-9 min-w-9 items-center justify-center rounded-lg bg-gray-800 px-2 text-sm font-medium text-white transition-colors hover:bg-gray-700 disabled:opacity-40';

/**
 * "Mark as watched" plus a 0.5–10 rating with ±1 and ±0.1 buttons, independent of the watchlist. The
 * rating only appears once the title is marked watched, and starts at 5. Both are optimistic and roll
 * back if the server rejects them. Signed-out visitors get a sign-in link instead.
 */
export function WatchedRating({
  tmdbId,
  watched: initialWatched,
  rating: initialRating,
}: {
  tmdbId: number;
  watched: boolean;
  rating: number | null;
}) {
  const viewer = useViewer();
  const [watched, setWatchedState] = useState(initialWatched);
  const [rating, setRatingState] = useState<number | null>(initialRating);
  const [pending, startTransition] = useTransition();

  if (!viewer) {
    return (
      <Link href={`/login?next=${encodeURIComponent(`/movie/${tmdbId}`)}`} className={BUTTON}>
        <Eye className="h-4 w-4" aria-hidden="true" />
        <span>Sign in to track</span>
      </Link>
    );
  }

  const toggleWatched = () => {
    const next = !watched;
    const previousRating = rating;
    setWatchedState(next);
    if (!next) setRatingState(null);
    startTransition(async () => {
      try {
        await setWatched(tmdbId, next);
      } catch {
        setWatchedState(!next);
        setRatingState(previousRating); // the optimistic clear above has to be undone too
      }
    });
  };

  const commitRating = (value: number | null) => {
    const previousRating = rating;
    setRatingState(value);
    startTransition(async () => {
      try {
        await setRating(tmdbId, value);
      } catch {
        setRatingState(previousRating);
      }
    });
  };

  // Nudge from the current value (or the default 5 while unrated), clamped to the scale.
  const adjust = (delta: number) => {
    const current = rating ?? DEFAULT;
    const next = Math.round(Math.min(MAX, Math.max(MIN, current + delta)) * 10) / 10;
    if (next !== rating) commitRating(next);
  };

  const shown = rating ?? DEFAULT;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={toggleWatched}
        disabled={pending}
        aria-pressed={watched}
        aria-label={watched ? 'Remove from watched' : 'Mark as watched'}
        className={BUTTON}
      >
        {watched ? <Check className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        <span>{watched ? 'Watched' : 'Mark as watched'}</span>
      </button>

      {watched && (
        <>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => adjust(-1)} disabled={pending || shown <= MIN} aria-label="Lower rating by 1" className={STEP_BUTTON}>
              −1
            </button>
            <button type="button" onClick={() => adjust(-0.1)} disabled={pending || shown <= MIN} aria-label="Lower rating by 0.1" className={STEP_BUTTON}>
              −0.1
            </button>
            <span
              className={`w-12 text-center text-base tabular-nums ${rating != null ? 'text-white' : 'text-gray-400'}`}
              aria-live="polite"
            >
              {shown.toFixed(1)}
            </span>
            <button type="button" onClick={() => adjust(0.1)} disabled={pending || shown >= MAX} aria-label="Raise rating by 0.1" className={STEP_BUTTON}>
              +0.1
            </button>
            <button type="button" onClick={() => adjust(1)} disabled={pending || shown >= MAX} aria-label="Raise rating by 1" className={STEP_BUTTON}>
              +1
            </button>
          </div>
          {rating != null && (
            <button
              type="button"
              onClick={() => commitRating(null)}
              disabled={pending}
              aria-label="Clear rating"
              className="rounded p-1 text-gray-400 transition-colors hover:text-white disabled:opacity-60"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
