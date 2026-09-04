'use client';

import type { FramingKind } from '@/lib/contracts/yoga';
import styles from './FramingHint.module.css';

interface FramingHintProps {
  /** Which framing problem the coach is reporting, or null for none. */
  kind: FramingKind | null;
  /** Visible but unreliable (confidence below the backend's own floor). */
  lowConfidence: boolean;
  confidence: number;
}

/**
 * The "the coach cannot see you" state.
 *
 * When a required joint is missing the backend short-circuits before it looks
 * at any angles, and says so instead of returning a form fault. That must
 * never be dressed up as a form problem: telling someone their knee is wrong
 * when the camera cannot see their knee sends them adjusting a leg that was
 * fine.
 *
 * There are two causes and they take opposite advice, so they get different
 * treatment here. `out-of-frame` shows the dashed box — the same one the
 * landing page's step 1 shows, so the fix is already familiar by the time it
 * appears — because the box is an instruction to fit inside it. `unreadable`
 * means the body is *already* inside that box, so drawing it would tell the
 * user to do the thing they are doing; only the label appears.
 */
export function FramingHint({ kind, lowConfidence, confidence }: FramingHintProps) {
  if (!kind && !lowConfidence) return null;

  const label =
    kind === 'out-of-frame'
      ? 'whole body in frame'
      : kind === 'unreadable'
        ? 'can’t see you clearly'
        : `confidence ${Math.round(confidence * 100)}%`;

  return (
    <div className={styles.hint} data-severity={kind ? 'blocking' : 'soft'}>
      <span className={`mono ${styles.label}`}>{label}</span>
      {kind !== 'unreadable' && <div className={styles.box} />}
    </div>
  );
}
