'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, Eye, X } from 'lucide-react';
import { setRating, setWatched } from '@/app/watched/actions';
import { useViewer } from './ViewerProvider';

// Matches the server's scale (src/lib/watched.ts): TMDB's 0–10, one decimal. 0 = unrated.
const MIN = 0.5;
const MAX = 10;
const STEP = 0.1;
const DEFAULT = 5; // where the thumb sits while the title is unrated

const BUTTON =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-gray-800 px-4 py-2.5 font-medium text-white transition-colors hover:bg-gray-700 aria-pressed:bg-gray-700 aria-pressed:hover:bg-gray-600';

/**
 * "Mark as watched" plus a 0.5–10 decimal rating, independent of the watchlist. Both are optimistic
 * and roll back if the server rejects them. Dragging the slider commits once you let go (not per step),
 * and setting a rating marks the title watched. Signed-out visitors get a sign-in link instead.
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
  const [draft, setDraft] = useState<number | null>(null); // live slider position before it's committed
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => clearTimer, []);

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
    const previousWatched = watched;
    const previousRating = rating;
    setWatchedState(true);
    setRatingState(value);
    startTransition(async () => {
      try {
        await setRating(tmdbId, value);
      } catch {
        setWatchedState(previousWatched);
        setRatingState(previousRating);
      }
    });
  };

  // While dragging, show the draft; commit it shortly after the last change (and immediately on release).
  const slide = (value: number) => {
    setDraft(value);
    clearTimer();
    timer.current = setTimeout(() => {
      setDraft(null);
      commitRating(value);
    }, 300);
  };
  const release = () => {
    clearTimer();
    if (draft != null) {
      setDraft(null);
      commitRating(draft);
    }
  };

  const shown = draft ?? rating ?? DEFAULT;

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

      <div className="flex items-center gap-2">
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={STEP}
          value={shown}
          onChange={(e) => slide(Number(e.target.value))}
          onPointerUp={release}
          onKeyUp={release}
          onBlur={release}
          disabled={pending}
          aria-label="Your rating out of 10"
          className="h-1.5 w-40 cursor-pointer appearance-none rounded-full bg-gray-700 accent-primary disabled:opacity-60"
        />
        <span className="w-8 text-sm tabular-nums text-gray-300" aria-live="polite">
          {rating != null || draft != null ? shown.toFixed(1) : '—'}
        </span>
        <span className="text-xs text-gray-500">/10</span>
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
      </div>
    </div>
  );
}
