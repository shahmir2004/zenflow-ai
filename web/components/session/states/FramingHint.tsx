'use client';

import styles from './FramingHint.module.css';

interface FramingHintProps {
  /** Not visible at all — the backend could not evaluate geometry. */
  active: boolean;
  /** Visible but unreliable (confidence below the backend's own floor). */
  lowConfidence: boolean;
  confidence: number;
}

/**
 * The "step back" state.
 *
 * When a required joint is missing the backend short-circuits before it looks
 * at any angles, and returns `Body not fully visible` with an empty
 * joint_colors map. That is a framing problem, and it must never be dressed up
 * as a form problem: telling someone their knee is wrong when the camera
 * cannot see their knee sends them adjusting a leg that was fine.
 *
 * The dashed box is the same one the landing page's step 1 shows, so the fix
 * is already familiar by the time it appears.
 */
export function FramingHint({ active, lowConfidence, confidence }: FramingHintProps) {
  if (!active && !lowConfidence) return null;

  return (
    <div className={styles.hint} data-severity={active ? 'blocking' : 'soft'}>
      <span className={`mono ${styles.label}`}>
        {active ? 'whole body in frame' : `confidence ${Math.round(confidence * 100)}%`}
      </span>
      <div className={styles.box} />
    </div>
  );
}
