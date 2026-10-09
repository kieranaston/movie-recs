/**
 * Rows always show a whole number of posters: N per screen width (3 phone → 7 wide), each sized to
 * fill the row exactly, with scroll-snap so swiping/scrolling never stops mid-poster.
 */
export const POSTER_ROW =
  'grid grid-flow-col gap-3 overflow-x-auto snap-x snap-mandatory ' +
  '[--cols:3] sm:[--cols:4] md:[--cols:5] lg:[--cols:6] xl:[--cols:7] ' +
  'auto-cols-[calc((100%_-_(var(--cols)_-_1)*0.75rem)/var(--cols))]';

export const ROW_GAP_PX = 12; // matches gap-3

/** Loading placeholder shaped exactly like the rows. */
export function RowsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-8">
      {Array.from({ length: rows }).map((_, s) => (
        <div key={s}>
          <div className="mb-3 h-6 w-40 animate-pulse rounded bg-gray-800" />
          <div className={`${POSTER_ROW} overflow-hidden`}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-gray-800" />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
