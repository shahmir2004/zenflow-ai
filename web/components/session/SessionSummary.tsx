'use client';

import Link from 'next/link';
import { motion } from 'motion/react';
import type { SessionSummary as Summary } from '@/lib/hooks/useYogaFlow';
import styles from './SessionSummary.module.css';

interface SessionSummaryProps {
  summary: Summary;
  onFlowAgain: () => void;
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * The headline figure, in the unit that actually describes the session. A
 * single 25-second hold rounded to "1 minute" overstates what happened, and
 * the summary is the one screen that should not flatter.
 */
function describeDuration(totalSeconds: number): string {
  const rounded = Math.round(totalSeconds);
  if (rounded <= 0) return 'Ready when you are.';
  if (rounded < 60) return `A steady ${rounded} seconds.`;
  const minutes = Math.round(rounded / 60);
  return minutes === 1 ? 'A steady minute.' : `A steady ${minutes} minutes.`;
}

/**
 * What the session added up to, and what to work on next.
 *
 * The "to fix next" list is the point of the screen: it is the only place the
 * corrections stop being transient. Each row is a real count of how many times
 * that cue came up, so it reflects the session rather than flattering it.
 */
export function SessionSummary({ summary, onFlowAgain }: SessionSummaryProps) {
  const { totalHeldSeconds, posesToTarget, totalPoses, best, toFixNext } = summary;
  const held = formatDuration(totalHeldSeconds);

  return (
    <div className={styles.backdrop}>
      <motion.div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-label="Session complete"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      >
        <span className="tag tag-accent-2">Session complete</span>

        <h3 className={styles.title}>{describeDuration(totalHeldSeconds)}</h3>

        <p className={styles.lede}>
          {posesToTarget === totalPoses
            ? 'You held every pose to target. Here’s what the coach would work on next time.'
            : `You held ${posesToTarget} of ${totalPoses} poses to target. Here’s what the coach would work on next time.`}
        </p>

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{held}</span>
            <span className={`mono ${styles.statLabel}`}>Total hold</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>
              {posesToTarget} / {totalPoses}
            </span>
            <span className={`mono ${styles.statLabel}`}>Poses to target</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{best ? `${best.heldSeconds}s` : '—'}</span>
            <span className={`mono ${styles.statLabel}`}>
              {best ? `Best · ${best.displayName}` : 'Best hold'}
            </span>
          </div>
        </div>

        {toFixNext.length > 0 ? (
          <>
            <h6 className={styles.fixHeading}>To fix next</h6>
            <ul className={styles.fixList}>
              {toFixNext.map((item) => (
                <li key={`${item.poseId}-${item.correction}`} className={styles.fixRow}>
                  <span className={styles.fixText}>
                    <span className={styles.fixCorrection}>{item.correction}</span>
                    <span className={styles.fixPose}>{item.poseName}</span>
                  </span>
                  <span className="tag tag-accent">{item.count}×</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className={styles.clean}>
            No repeated corrections this session. Your form held steady throughout.
          </p>
        )}

        <div className={styles.actions}>
          <Link href="/" className="btn btn-secondary">
            Back to landing
          </Link>
          <button type="button" className="btn btn-primary" onClick={onFlowAgain}>
            Flow again
          </button>
        </div>
      </motion.div>
    </div>
  );
}
