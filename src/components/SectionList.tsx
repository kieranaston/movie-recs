import { getBrowsePage } from '@/lib/browse';
import { getWatchlistIds } from '@/lib/watchlist';
import { SectionRow } from './SectionRow';
import { CatalogMovieCard } from './CatalogMovieCard';
import type { GenreFilter } from '@/lib/taxonomy';

export async function SectionList({ genreId, filter }: { genreId?: number; filter?: GenreFilter }) {
  const [result, watchlistIds] = await Promise.all([
    getBrowsePage({ genreId, filter }),
    getWatchlistIds(),
  ]);

  if (result.mode === 'list') {
    return (
      <div>
        <p className="text-sm text-gray-500 mb-3">{result.total} titles · best to worst</p>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
          {result.movies.map((m) => (
            <CatalogMovieCard key={m.id} movie={m} inWatchlist={watchlistIds.includes(m.tmdbId)} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      {result.sections.map((s) =>
        s.movies.length ? (
          <SectionRow
            key={s.id}
            id={s.id}
            label={s.label}
            blurb={s.blurb}
            genreId={genreId}
            initialMovies={s.movies}
            total={s.total}
            savedIds={watchlistIds}
          />
        ) : null
      )}
    </>
  );
}
