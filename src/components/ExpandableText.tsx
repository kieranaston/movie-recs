'use client';

import { useId, useLayoutEffect, useRef, useState } from 'react';

const CLAMPED = 'line-clamp-4 sm:line-clamp-5';
const BASE = 'whitespace-pre-line leading-relaxed';

/**
 * Long text (a movie overview) clamped to a few lines, with a "Read more" toggle to reveal the
 * rest. A hidden, unclamped copy measures the full height: `scrollHeight` on a line-clamped box
 * doesn't report the clipped overflow, so clipping can't be detected from the visible element.
 * The copy is watched for size changes (fonts, reflows) so the toggle shows even when the text
 * only becomes clipped after the web font swaps in. The toggle appears only when the text is
 * actually clipped, so short text is untouched.
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
    // A web font swapping in (or any other reflow) resizes the hidden copy; re-measure so the
    // toggle appears when the text is clipped only after the real font loads. Observing the copy
    // covers window resizes too: it shares the visible element's width and is never clamped.
    const observer = new ResizeObserver(measure);
    observer.observe(full);
    void document.fonts?.ready.then(measure);
    return () => observer.disconnect();
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
