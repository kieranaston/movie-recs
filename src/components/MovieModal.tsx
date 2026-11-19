'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

/**
 * Popup shell for a movie opened from a list. Closing goes back in history, so the list underneath
 * (never unmounted) is exactly where you left it. Closes on the ✕, Escape, or a click outside.
 */
export function MovieModal({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.back();
    };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
      previous?.focus({ preventScroll: true }); // back to the poster you opened
    };
  }, [router]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-0 sm:p-6"
      onClick={(e) => e.target === e.currentTarget && router.back()} // only clicks on the backdrop itself
    >
      <div role="dialog" aria-modal="true" aria-label="Movie details" className="relative w-full max-w-6xl rounded-none bg-gray-950 shadow-2xl sm:my-4 sm:rounded-2xl sm:border sm:border-gray-800">
        <button
          ref={closeButton}
          type="button"
          onClick={() => router.back()}
          className="absolute right-3 top-3 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-700/60 bg-gray-950/80 text-white backdrop-blur hover:bg-gray-800"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        {children}
      </div>
    </div>
  );
}
