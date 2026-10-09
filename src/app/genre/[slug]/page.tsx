import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SectionList } from '@/components/SectionList';
import { genreBySlug } from '@/lib/taxonomy';

export const dynamic = 'force-dynamic';

function SectionsSkeleton() {
  return (
    <div className="space-y-8">
      {Array.from({ length: 4 }).map((_, s) => (
        <div key={s}>
          <div className="h-6 w-40 bg-gray-800 animate-pulse rounded mb-3" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="w-[132px] sm:w-[148px] shrink-0 aspect-[2/3] rounded-lg bg-gray-800 animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function GenrePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const { slug } = await params;
  const { filter } = await searchParams;
  const genre = genreBySlug(slug);
  if (!genre) notFound();

  const selected = genre.filters.find((f) => f.label === filter);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-bold text-white mb-4">{genre.name}</h1>

      {genre.filters.length > 0 && (
        <nav aria-label={`${genre.name} filters`} className="-mx-4 mb-6 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          <ul className="flex gap-2">
            {[{ label: 'All', href: `/genre/${genre.slug}`, active: !selected }, ...genre.filters.map((f) => ({
              label: f.label,
              href: `/genre/${genre.slug}?filter=${encodeURIComponent(f.label)}`,
              active: selected?.label === f.label,
            }))].map((chip) => (
              <li key={chip.label} className="shrink-0">
                <Link
                  href={chip.href}
                  aria-current={chip.active ? 'page' : undefined}
                  className={`inline-block rounded-full border px-4 py-1.5 text-sm transition-colors ${
                    chip.active ? 'border-white bg-white text-gray-900' : 'border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white'
                  }`}
                >
                  {chip.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <Suspense fallback={<SectionsSkeleton />}>
        <SectionList genreId={genre.tmdbId} filter={selected} />
      </Suspense>
    </div>
  );
}
