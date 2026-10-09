import { Suspense } from 'react';
import { RowsSkeleton } from '@/components/poster-row';
import { SectionList } from '@/components/SectionList';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
      <h1 className="sr-only">Discover Movies</h1>
      <Suspense fallback={<RowsSkeleton rows={3} />}>
        <SectionList />
      </Suspense>
    </div>
  );
}
