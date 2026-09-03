'use client';

import { HeroSkeleton } from './HeroSkeleton';
import { getYogaPose } from '@/lib/data/poses';
import styles from './HeroCenterpiece.module.css';

const HERO_POSE = 'tree';

/**
 * Concentric rings breathing on a 16s cycle around a disc where the skeleton
 * settles on a 14s cycle.
 *
 * The two periods are deliberately different. In phase they would resolve into
 * one mechanical loop that the eye locks onto within a few seconds; out of
 * phase the composition keeps finding new arrangements for well over a minute,
 * which is what makes it read as breathing rather than as an animation.
 */
export function HeroCenterpiece() {
  const pose = getYogaPose(HERO_POSE);

  return (
    <div className={styles.centerpiece}>
      <div className={`${styles.ring} ${styles.ringOuter} zf-breath`} />
      <div className={`${styles.ring} ${styles.ringSage} zf-breath-soft`} />
      <div className={`${styles.ring} ${styles.discFill} zf-breath`} />

      <div className={`${styles.disc} zf-breath`}>
        <div className={styles.discGround} />
        {/* A cream ring inside the disc's edge separates it from the filled
            disc behind, which is what stops the layers reading as one blob. */}
        <div className={styles.discEdge} />

        {/* The hold ring, sweeping to full as the pose locks. */}
        <svg viewBox="0 0 200 200" className={styles.sweep} aria-hidden="true">
          <circle
            cx="100"
            cy="100"
            r="94"
            fill="none"
            stroke="var(--color-accent-2-500)"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="590.6"
            strokeDashoffset="590.6"
            className={styles.sweepStroke}
          />
        </svg>

        <div className={styles.figureBox}>
          <HeroSkeleton poseId={HERO_POSE} />
        </div>
      </div>

      {/* Status chip — what the live session says when a hold is running. */}
      <div className={styles.statusChip}>
        <span className={`${styles.statusDot} zf-dot`} aria-hidden="true" />
        <span>Form locked · holding</span>
      </div>

      {/* Breath pacer, cross-fading across the same 16s cycle as the rings. */}
      <div className={styles.breathChip}>
        <div className={styles.breathLabels}>
          <span className="zf-phase-inhale">Inhale</span>
          <span className="zf-phase-hold">Hold</span>
          <span className="zf-phase-exhale">Exhale</span>
        </div>
        <div className={styles.breathCount}>4 · 4 · 8</div>
      </div>

      <p className={styles.caption}>
        {pose ? `${pose.name.toLowerCase()} · ${pose.holdTargetSeconds}s hold` : ''}
      </p>
    </div>
  );
}
