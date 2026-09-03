'use client';

import styles from './HoldRing.module.css';

interface HoldRingProps {
  /** 0..1 */
  progress: number;
  seconds: number;
  targetSeconds: number;
  complete?: boolean;
  /** Replaces the readout — used by the pre-session framing countdown. */
  countdown?: number;
  className?: string;
}

/** Circumference at r=54, to one decimal. */
const CIRCUMFERENCE = 339.3;

/**
 * The hold ring: elapsed seconds against the pose's target.
 *
 * Turns from terracotta to sage on completion, which is the same green the
 * skeleton uses for a valid joint — one colour language for "this is right",
 * readable from a mat without reading any text.
 */
export function HoldRing({
  progress,
  seconds,
  targetSeconds,
  complete = false,
  countdown,
  className,
}: HoldRingProps) {
  const clamped = Math.min(1, Math.max(0, progress));
  const offset = CIRCUMFERENCE * (1 - clamped);

  return (
    <div className={[styles.ring, className].filter(Boolean).join(' ')}>
      <svg viewBox="0 0 120 120" className={styles.svg} aria-hidden="true">
        <circle cx="60" cy="60" r="54" className={styles.track} />
        <circle
          cx="60"
          cy="60"
          r="54"
          className={styles.fill}
          data-complete={complete}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
        />
      </svg>

      <div className={styles.readout}>
        {countdown !== undefined ? (
          <span className={styles.countdown}>{countdown}</span>
        ) : (
          <>
            <span className={styles.seconds}>{Math.floor(seconds)}s</span>
            <span className={`mono ${styles.target}`}>of {Math.round(targetSeconds)}s</span>
          </>
        )}
      </div>

      {/* The ring is decorative; this is what a screen reader announces. */}
      <span className="sr-only" role="status">
        {complete
          ? 'Hold complete'
          : `Held ${Math.floor(seconds)} of ${Math.round(targetSeconds)} seconds`}
      </span>
    </div>
  );
}
