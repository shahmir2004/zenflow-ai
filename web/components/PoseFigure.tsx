'use client';

import { useId } from 'react';
import {
  BASE_SKELETON,
  EDGES,
  JOINT_KEYS,
  JOINT_STATE_COLOR,
  edgeState,
  skeletonFor,
  type JointKey,
  type JointState,
  type Skeleton,
} from '@/lib/data/skeletons';
import styles from './PoseFigure.module.css';

interface PoseFigureProps {
  /** A pose label. Falls back to the neutral standing figure. */
  poseId?: string;
  /** Override the resolved skeleton — the sticky mock supplies its own. */
  skeleton?: Skeleton;
  /**
   * Joints to flag. The library and sheet pass nothing: a reference figure
   * shows the pose done *right*, and a red knee on a reference card would
   * contradict what red means in the live view.
   */
  flags?: Partial<Record<JointKey, JointState>>;
  /** Draws a faint rule under the figure's lowest joint. */
  ground?: boolean;
  className?: string;
  /** Announced to screen readers; the figure is decorative without it. */
  label?: string;
  /**
   * Crops to the figure's own extents. A replayed frame occupies whatever
   * slice of the coordinate space the body happened to fill, and the default
   * square box letterboxes that into a fraction of the available height.
   */
  viewBox?: string;
}

/**
 * A pose drawn as a line figure.
 *
 * This stands in for photography everywhere the design called for it. It earns
 * the slot rather than merely filling it: the library figure and the skeleton
 * drawn over your own body are the same 13 joints and 12 bones, so reading the
 * library is practice for reading the live overlay.
 */
export function PoseFigure({
  poseId,
  skeleton,
  flags,
  ground = true,
  className,
  label,
  viewBox = '0 0 100 100',
}: PoseFigureProps) {
  const gradientId = useId().replace(/:/g, '');
  const points = skeleton ?? (poseId ? skeletonFor(poseId) : { ...BASE_SKELETON });

  const stateOf = (key: JointKey): JointState => flags?.[key] ?? 'ok';

  // The floor sits just below the lowest joint, so it grounds a standing
  // figure and a floor pose equally without a per-pose constant.
  const lowestY = Math.max(...JOINT_KEYS.map((k) => points[k][1]));
  const floorY = Math.min(lowestY + 4, 98);

  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio="xMidYMid meet"
      className={[styles.figure, className].filter(Boolean).join(' ')}
      role={label ? 'img' : 'presentation'}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent-2-500)" />
          <stop offset="100%" stopColor="var(--color-accent-2-700)" />
        </linearGradient>
      </defs>

      {ground && (
        <line
          x1="8"
          y1={floorY}
          x2="92"
          y2={floorY}
          className={styles.floor}
          vectorEffect="non-scaling-stroke"
        />
      )}

      {EDGES.map(([a, b]) => {
        const state = edgeState(stateOf(a), stateOf(b));
        const stroke = flags ? JOINT_STATE_COLOR[state] : `url(#${gradientId})`;
        return (
          <line
            key={`${a}-${b}`}
            x1={points[a][0]}
            y1={points[a][1]}
            x2={points[b][0]}
            y2={points[b][1]}
            stroke={stroke}
            className={styles.bone}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}

      {JOINT_KEYS.map((key) => {
        const state = stateOf(key);
        const fill = flags ? JOINT_STATE_COLOR[state] : 'var(--color-accent-2-600)';
        return (
          <circle
            key={key}
            cx={points[key][0]}
            cy={points[key][1]}
            r={key === 'head' ? 4.4 : 2.4}
            fill={fill}
            className={
              state === 'ok' || !flags
                ? styles.joint
                : `${styles.jointFlagged} zf-dot`
            }
          />
        );
      })}
    </svg>
  );
}
