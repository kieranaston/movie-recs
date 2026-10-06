import { Suspense } from 'react';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MovieGrid, MovieCardSkeleton } from '@/components/MovieCard';
import { searchMovies, type TMDBSearchResponse } from '@/lib/tmdb';

export const dynamic = 'force-dynamic';

interface SearchPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

async function SearchResults({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q?.trim().slice(0, 100) ?? '';
  const parsed = Number.parseInt(params.page ?? '1', 10);
  const page = Number.isInteger(parsed) ? Math.min(Math.max(parsed, 1), 500) : 1; // TMDB serves pages 1–500

  if (!query) {
    return (
      <div className="text-center py-16">
        <Search className="h-16 w-16 mx-auto text-gray-600 mb-4" aria-hidden="true" />
        <h2 className="text-2xl font-bold text-white mb-2">Search for Movies</h2>
        <p className="text-gray-400">Enter a movie title to find what you&apos;re looking for</p>
      </div>
    );
  }

  let data: TMDBSearchResponse;
  try {
    data = await searchMovies(query, page);
  } catch {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>Unable to search movies right now.</p>
        <p className="text-sm mt-1">Please try again later.</p>
      </div>
    );
  }

  if (data.results.length === 0) {
    return (
      <div className="text-center py-16">
        <Search className="h-16 w-16 mx-auto text-gray-600 mb-4" aria-hidden="true" />
        <h2 className="text-2xl font-bold text-white mb-2">No Results Found</h2>
        <p className="text-gray-400">No movies found for &ldquo;{query}&rdquo;</p>
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white">
          Results for &ldquo;<span className="text-primary">{query}</span>&rdquo;
        </h2>
        <p className="text-gray-400 mt-1">
          {data.total_results} result{data.total_results !== 1 ? 's' : ''} • Page {page} of {data.total_pages}
        </p>
      </div>

      <MovieGrid movies={data.results} />

      {data.total_pages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pagination">
          {page > 1 && (
            <Link
              href={`/search?q=${encodeURIComponent(query)}&page=${page - 1}`}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-md text-white transition-colors"
            >
              Previous
            </Link>
          )}
          <span className="px-4 py-2 text-gray-400">
            Page {page} of {data.total_pages}
          </span>
          {page < data.total_pages && (
            <Link
              href={`/search?q=${encodeURIComponent(query)}&page=${page + 1}`}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-md text-white transition-colors"
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

function SearchResultsSkeleton() {
  return (
    <div>
      <div className="mb-6">
        <div className="h-8 w-64 bg-gray-800 animate-pulse rounded mb-2" />
        <div className="h-4 w-48 bg-gray-800 animate-pulse rounded" />
      </div>
      <MovieCardSkeleton />
      <nav className="mt-8 flex items-center justify-center gap-2">
        <div className="h-10 w-24 bg-gray-800 animate-pulse rounded" />
        <div className="h-10 w-32 bg-gray-800 animate-pulse rounded" />
        <div className="h-10 w-24 bg-gray-800 animate-pulse rounded" />
      </nav>
    </div>
  );
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <section className="mb-8" aria-labelledby="search-heading">
        <div className="max-w-2xl mx-auto">
          <form action="/search" className="flex gap-2" role="search">
            <label htmlFor="search-input" className="sr-only">
              Search movies
            </label>
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" aria-hidden="true" />
              <Input
                id="search-input"
                name="q"
                type="search"
                placeholder="Search for a movie..."
                defaultValue={(await searchParams).q ?? ''}
                className="pl-10 h-12 text-lg bg-gray-800 border-gray-700 focus:border-primary"
              />
            </div>
            <Button type="submit" className="h-12 px-6 text-lg bg-primary hover:bg-red-700">
              Search
            </Button>
          </form>
        </div>
      </section>

      <Suspense fallback={<SearchResultsSkeleton />}>
        <SearchResults searchParams={searchParams} />
      </Suspense>

      {/* TODO: Add filter/sort options here */}
    </div>
  );
}