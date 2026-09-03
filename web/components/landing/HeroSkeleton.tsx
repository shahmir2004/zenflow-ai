'use client';

import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';
import { EDGES, JOINT_KEYS, driftOffset, skeletonFor } from '@/lib/data/skeletons';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';
import styles from './HeroSkeleton.module.css';

/** The whole cycle. Every phase below is a fraction of it, so they stay in step. */
const CYCLE = 14;
const at = (fraction: number) => CYCLE * fraction;

/** Read a design token's computed value — GSAP needs concrete colours to tween. */
function token(name: string, fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/**
 * The hero's signature motion: a skeleton assembling itself, locking, and
 * releasing on a 14s loop.
 *
 * Joints fly in from the quadrant they belong to, land one after another with
 * a slight overshoot, then turn from terracotta to sage as the pose locks —
 * the same colour language the live session uses for a valid joint. The hero
 * demonstrates the product's feedback rather than illustrating it.
 *
 * Driven by GSAP because thirteen joints each need their own start offset and
 * stagger inside one shared cycle; the prototype needed four hand-authored
 * keyframe sets to approximate it in CSS.
 *
 * Joints are HTML spans and bones are SVG, matching the prototype: the figure
 * box is tall and narrow, so the SVG stretches non-uniformly to fill it. Under
 * that stretch an SVG <circle> would render as an ellipse, which is why the
 * dots live outside it.
 */
export function HeroSkeleton({ poseId = 'tree' }: { poseId?: string }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion();
  const points = skeletonFor(poseId);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const ctx = gsap.context(() => {
      const dots = gsap.utils.toArray<HTMLElement>('[data-joint]');
      const bones = gsap.utils.toArray<SVGLineElement>('[data-bone]');
      const ghost = root.querySelector('[data-ghost]');

      const seeking = token('--color-accent-400', '#f6a06b');
      const landed = token('--color-accent', '#c67139');
      const valid = token('--color-accent-2-500', '#8fa073');

      if (reducedMotion) {
        // The settled state, held still — what the handoff asks for as the
        // reduced-motion fallback.
        gsap.set(dots, { scale: 1, opacity: 1, x: 0, y: 0, backgroundColor: valid });
        gsap.set(bones, { opacity: 0.75 });
        if (ghost) gsap.set(ghost, { opacity: 0.95 });
        return;
      }

      const offsetX = (i: number) => driftOffset(points[JOINT_KEYS[i]]).dx;
      const offsetY = (i: number) => driftOffset(points[JOINT_KEYS[i]]).dy;

      const tl = gsap.timeline({ repeat: -1, defaults: { overwrite: 'auto' } });

      // Drift in from the direction each joint belongs to, landing with a
      // touch of overshoot.
      tl.fromTo(
        dots,
        { opacity: 0, scale: 0.45, backgroundColor: seeking, x: offsetX, y: offsetY },
        {
          opacity: 1,
          scale: 1.3,
          backgroundColor: landed,
          x: 0,
          y: 0,
          duration: at(0.07),
          ease: 'power3.out',
          stagger: 0.1,
        },
        0
      );

      tl.to(dots, { scale: 1, duration: at(0.04), ease: 'power2.out', stagger: 0.1 }, at(0.07));

      // Bones fade in behind the landed joints.
      tl.fromTo(
        bones,
        { opacity: 0 },
        { opacity: 0.75, duration: at(0.1), ease: 'none', stagger: 0.06 },
        at(0.09)
      );

      // The target shape resolves underneath.
      if (ghost) {
        tl.fromTo(
          ghost,
          { opacity: 0 },
          { opacity: 0.95, duration: at(0.18), ease: 'power1.inOut' },
          at(0.12)
        );
      }

      // Form locks: joints turn sage, one after another.
      tl.to(dots, { backgroundColor: valid, duration: at(0.07), ease: 'none', stagger: 0.075 }, at(0.2));

      // Release, and the loop restarts.
      tl.to(
        dots,
        {
          opacity: 0,
          scale: 0.45,
          x: offsetX,
          y: offsetY,
          duration: at(0.03),
          ease: 'power2.in',
        },
        at(0.97)
      );
      tl.to(bones, { opacity: 0, duration: at(0.03) }, at(0.97));
      if (ghost) tl.to(ghost, { opacity: 0, duration: at(0.03) }, at(0.97));
    }, root);

    return () => ctx.revert();
  }, [reducedMotion, poseId, points]);

  return (
    <div ref={rootRef} className={styles.root} aria-hidden="true">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className={styles.canvas}
      >
        <g data-ghost className={styles.ghost}>
          {EDGES.map(([a, b]) => (
            <line
              key={`ghost-${a}-${b}`}
              x1={points[a][0]}
              y1={points[a][1]}
              x2={points[b][0]}
              y2={points[b][1]}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>

        {EDGES.map(([a, b]) => (
          <line
            key={`${a}-${b}`}
            data-bone
            x1={points[a][0]}
            y1={points[a][1]}
            x2={points[b][0]}
            y2={points[b][1]}
            className={styles.bone}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      {JOINT_KEYS.map((key) => (
        <span
          key={key}
          data-joint
          className={styles.joint}
          style={{ left: `${points[key][0]}%`, top: `${points[key][1]}%` }}
        />
      ))}
    </div>
  );
}
