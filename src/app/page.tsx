import { Suspense } from 'react';
import { SectionList } from '@/components/SectionList';

export const dynamic = 'force-dynamic';

function SectionsSkeleton() {
  return (
    <div className="space-y-10">
      {Array.from({ length: 3 }).map((_, s) => (
        <div key={s}>
          <div className="h-6 w-40 bg-gray-800 animate-pulse rounded mb-3" />
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] rounded-lg bg-gray-800 animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h1 className="text-2xl font-bold text-white mb-6">Discover Movies</h1>
      <Suspense fallback={<SectionsSkeleton />}>
        <SectionList />
      </Suspense>
    </div>
  );
}
