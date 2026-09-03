'use client';

import { useEffect, useState } from 'react';

/**
 * Tracks prefers-reduced-motion.
 *
 * The CSS media query in globals.css handles declarative animation; this hook
 * is for the GSAP timelines, which CSS cannot reach. Both must agree, or the
 * hero ends up half-animated.
 *
 * Defaults to `false` on the server so the first paint matches, then corrects
 * in the effect. Timelines are only built client-side, so they never see the
 * wrong value.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
