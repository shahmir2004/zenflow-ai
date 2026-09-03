'use client';

import { poseInitials, type YogaPose } from '@/lib/data/poses';
import styles from './PoseBadge.module.css';

interface PoseBadgeProps {
  pose: YogaPose;
  /** Flow position, e.g. "3 of 6". Omitted in single-pose mode. */
  step?: { index: number; total: number };
}

export function PoseBadge({ pose, step }: PoseBadgeProps) {
  return (
    <div className={styles.badge}>
      <span className={styles.initials} aria-hidden="true">
        {poseInitials(pose)}
      </span>

      <span className={styles.text}>
        <span className={styles.name}>{pose.name}</span>
        <span className={styles.meta}>
          {pose.sanskrit} ·{' '}
          {/* The camera view is not trivia. Floor poses read from a side view
              and detect noticeably worse from the front, so someone facing the
              lens for Cobra needs to know before they blame their form. */}
          <span data-view={pose.cameraView}>
            {pose.cameraView === 'side' ? 'Side camera' : 'Front camera'}
          </span>
          {step && ` · ${step.index} of ${step.total}`}
        </span>
      </span>
    </div>
  );
}
