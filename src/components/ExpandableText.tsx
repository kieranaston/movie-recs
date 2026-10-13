'use client';

import { useEffect, useId, useRef, useState } from 'react';

/**
 * Long text (a movie overview) clamped to a few lines, with a "Read more" toggle to reveal the
 * rest. The toggle only appears when the text is actually clipped, so short text is untouched.
 */
export function ExpandableText({ text }: { text: string }) {
  const id = useId();
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [clipped, setClipped] = useState(false);

  useEffect(() => {
    if (expanded) return; // measure the clamped height only
    const el = ref.current;
    if (!el) return;
    const measure = () => setClipped(el.scrollHeight > el.clientHeight + 1);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [text, expanded]);

  return (
    <div>
      <p
        ref={ref}
        id={id}
        className={`whitespace-pre-line leading-relaxed text-gray-200 ${expanded ? '' : 'line-clamp-4 sm:line-clamp-5'}`}
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
