'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';

/**
 * Inertial smooth scrolling, wired to GSAP.
 *
 * Lenis and ScrollTrigger both want to own the scroll loop. Left alone they
 * fight: ScrollTrigger reads a scroll position Lenis has already moved past,
 * and pinned sections judder. The fix is to make GSAP the single clock —
 * Lenis is raf'd by gsap.ticker, and every Lenis scroll event refreshes
 * ScrollTrigger.
 *
 * Disabled entirely under prefers-reduced-motion: hijacking scroll is exactly
 * the kind of motion that setting is asking us not to do.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    if (reducedMotion) return;

    const lenis = new Lenis({
      duration: 1.05,
      easing: (t) => Math.min(1, 1.001 - 2 ** (-10 * t)),
      smoothWheel: true,
      // Touch devices already have native inertia that feels better than ours.
      syncTouch: false,
    });

    lenis.on('scroll', ScrollTrigger.update);

    const raf = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, [reducedMotion]);

  return <>{children}</>;
}
