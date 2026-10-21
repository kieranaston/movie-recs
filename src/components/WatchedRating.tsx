'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { Check, Eye, X } from 'lucide-react';
import { setRating, setWatched } from '@/app/watched/actions';
import { useViewer } from './ViewerProvider';

// Matches the server's scale (src/lib/watched.ts): TMDB's 0–10. 0 = unrated, so 0.5 is the floor.
const MIN = 0.5;
const MAX = 10;
const STEP = 0.1;
const DEFAULT = 5; // where the thumb sits while the title is unrated

const BUTTON =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-gray-800 px-4 py-2.5 font-medium text-white transition-colors hover:bg-gray-700 aria-pressed:bg-gray-700 aria-pressed:hover:bg-gray-600';

/**
 * "Mark as watched" plus a 0.5–10 rating slider, independent of the watchlist. The slider only appears
 * once the title is marked watched. It moves locally and saves once when you let go (not per step), so
 * it never waits on the server mid-drag; a failed save rolls the value back. Signed-out visitors get a
 * sign-in link instead.
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
  const [draft, setDraft] = useState<number | null>(null); // live slider position before it's saved
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<number | null>(null);

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

  const save = (value: number | null) => {
    const previous = rating;
    setRatingState(value);
    startTransition(async () => {
      try {
        await setRating(tmdbId, value);
      } catch {
        setRatingState(previous);
      }
    });
  };

  // Drag updates the thumb instantly; the value is saved shortly after the last change (or on release).
  const slide = (value: number) => {
    latest.current = value;
    setDraft(value);
    clearTimer();
    timer.current = setTimeout(() => {
      setDraft(null);
      latest.current = null;
      save(value);
    }, 250);
  };
  const release = () => {
    clearTimer();
    if (latest.current != null) {
      const value = latest.current;
      latest.current = null;
      setDraft(null);
      save(value);
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

      {watched && (
        <>
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
            aria-label="Your rating out of 10"
            className="h-1.5 w-40 cursor-pointer appearance-none rounded-full bg-gray-700 accent-primary"
          />
          <span
            className={`w-8 text-sm tabular-nums ${rating != null || draft != null ? 'text-white' : 'text-gray-400'}`}
            aria-live="polite"
          >
            {shown.toFixed(1)}
          </span>
          {rating != null && (
            <button
              type="button"
              onClick={() => save(null)}
              aria-label="Clear rating"
              className="rounded p-1 text-gray-400 transition-colors hover:text-white"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
