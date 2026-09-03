'use client';

import { useEffect, useState } from 'react';

/**
 * Matches a media query in JS, for the cases CSS cannot reach — chiefly
 * choosing a motion variant, where the animated property itself differs
 * between layouts (a side panel slides in on x, a bottom sheet on y).
 *
 * Returns `false` on the server and on first paint, then corrects. Callers
 * should treat the desktop layout as the default so the correction is a
 * refinement rather than a visible jump.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const list = window.matchMedia(query);
    setMatches(list.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
