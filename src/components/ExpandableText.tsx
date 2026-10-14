'use client';

import { useId, useLayoutEffect, useRef, useState } from 'react';

const CLAMPED = 'line-clamp-4 sm:line-clamp-5';
const BASE = 'whitespace-pre-line leading-relaxed';

/**
 * Long text (a movie overview) clamped to a few lines, with a "Read more" toggle to reveal the
 * rest. A hidden, unclamped copy measures the full height: `scrollHeight` on a line-clamped box
 * doesn't report the clipped overflow, so clipping can't be detected from the visible element.
 * The toggle only appears when the text is actually clipped, so short text is untouched.
 */
export function ExpandableText({ text }: { text: string }) {
  const id = useId();
  const ref = useRef<HTMLParagraphElement>(null);
  const ghost = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clipped, setClipped] = useState(false);

  useLayoutEffect(() => {
    if (expanded) return; // the clamped height is what we measure
    const el = ref.current;
    const full = ghost.current;
    if (!el || !full) return;
    const measure = () => setClipped(full.scrollHeight > el.clientHeight + 1);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [text, expanded]);

  return (
    <div className="relative">
      <p ref={ref} id={id} className={`${BASE} text-gray-200 ${expanded ? '' : CLAMPED}`}>
        {text}
      </p>
      <p
        ref={ghost}
        aria-hidden="true"
        className={`${BASE} invisible pointer-events-none absolute inset-x-0 top-0`}
      >
        {text}
      </p>
      {(clipped || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls={id}
          className="mt-2 text-sm font-medium text-primary hover:underline"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}
