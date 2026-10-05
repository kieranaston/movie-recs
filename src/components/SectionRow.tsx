'use client';

import { useRef, useState, useTransition } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CatalogMovieCard } from './CatalogMovieCard';
import { loadMoreSection } from '@/app/browse-actions';
import type { CardMovie } from '@/lib/browse';
import type { SectionId } from '@/lib/taxonomy';

export function SectionRow({
  id,
  label,
  blurb,
  genreId,
  initialMovies,
  total,
  savedIds,
}: {
  id: SectionId;
  label: string;
  blurb: string;
  genreId?: number;
  initialMovies: CardMovie[];
  total: number;
  savedIds: number[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [extra, setExtra] = useState<CardMovie[]>([]);
  const [, startTransition] = useTransition();
  const loadingRef = useRef(false);

  const movies = extra.length ? [...initialMovies, ...extra] : initialMovies;

  const loadMore = () => {
    if (loadingRef.current || movies.length >= total) return;
    loadingRef.current = true;
    startTransition(async () => {
      try {
        const res = await loadMoreSection({ genreId, sectionId: id, offset: movies.length, limit: 20 });
        setExtra((prev) => [...prev, ...res.movies]);
      } finally {
        loadingRef.current = false;
      }
    });
  };

  const scroll = (dir: number) => {
    const el = ref.current;
    if (!el) return;
    const page = el.clientWidth * 0.9;
    const max = el.scrollWidth - el.clientWidth;
    const target = Math.max(0, Math.min(el.scrollLeft + dir * page, max));
    if ('scrollBehavior' in document.documentElement.style) {
      el.scrollTo({ left: target, behavior: 'smooth' });
    } else {
      el.scrollLeft = target;
    }
    // Arrowing toward the end pulls the next page.
    if (dir > 0 && el.scrollLeft + el.clientWidth >= el.scrollWidth - page) loadMore();
  };

  return (
    <section className="mb-8" aria-labelledby={`section-${id}`}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 id={`section-${id}`} className="text-xl font-bold text-white">
          {label}
        </h2>
        <div className="flex items-center gap-1.5">
          <span className="hidden sm:inline text-xs text-gray-500 mr-1">{blurb}</span>
          <button
            type="button"
            onClick={() => scroll(-1)}
            aria-label={`Scroll ${label} left`}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-800"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scroll(1)}
            aria-label={`Scroll ${label} right`}
            className="p-1.5 rounded-md text-gray-400 hover:text-white hover:bg-gray-800"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div ref={ref} className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {movies.map((m) => (
          <div key={m.id} className="w-[132px] sm:w-[148px] shrink-0">
            <CatalogMovieCard movie={m} inWatchlist={savedIds.includes(m.tmdbId)} />
          </div>
        ))}
      </div>
    </section>
  );
}
