'use client';

import styles from './CueLine.module.css';

export type CueKind = 'correcting' | 'holding' | 'complete' | 'framing' | 'waiting';

interface CueLineProps {
  kind: CueKind;
  /** The one thing to say. Never a list. */
  message: string;
  /** Shown in the kicker chip while holding, e.g. 68. */
  progressPercent?: number;
  voiceOn?: boolean;
}

function kicker(kind: CueKind, progressPercent: number, voiceOn: boolean): string {
  switch (kind) {
    case 'complete':
      return 'hold complete';
    case 'correcting':
      return voiceOn ? 'voice coach · correcting' : 'correcting';
    case 'framing':
      return 'framing';
    case 'holding':
      return `holding · ${Math.round(progressPercent)}%`;
    default:
      return 'ready';
  }
}

/**
 * One correction at a time, in the display face, large enough to read from a
 * mat several feet away.
 *
 * The backend often returns several violations at once. Showing them as a list
 * is worse than useless mid-pose: someone holding Warrior II cannot act on
 * three instructions, and reading them takes longer than the hold. Only
 * `corrections[0]` ever reaches this component.
 */
export function CueLine({
  kind,
  message,
  progressPercent = 0,
  voiceOn = true,
}: CueLineProps) {
  return (
    <div className={styles.cue}>
      <span className={styles.kicker} data-kind={kind}>
        <span className={`${styles.dot} zf-pulse`} aria-hidden="true" />
        {kicker(kind, progressPercent, voiceOn)}
      </span>

      {/* aria-live so the correction is announced as it changes, matching what
          the voice coach says out loud. */}
      <p className={styles.message} data-kind={kind} aria-live="polite">
        {message}
      </p>
    </div>
  );
}
