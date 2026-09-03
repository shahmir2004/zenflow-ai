'use client';

import {
  BACKEND_COLOR_TO_STATE,
  EDGES,
  JOINT_KEYS,
  JOINT_META,
  JOINT_STATE_COLOR,
  edgeState,
  type JointKey,
  type JointState,
} from '@/lib/data/skeletons';
import type { PoseLandmark } from '@/lib/contracts/yoga';
import styles from './SkeletonOverlay.module.css';

interface SkeletonOverlayProps {
  landmarks: PoseLandmark[];
  /** joint_colors from the backend, keyed by snake_case joint name. */
  jointColors: Record<string, string>;
  /** Mirror to match the mirrored camera preview. */
  mirrored?: boolean;
  /** The aspect ratio of the box the landmarks are normalised against. */
  aspectRatio?: number;
  /**
   * 'cover' matches a video painted with object-fit: cover — the only correct
   * choice over a real camera. 'contain' letterboxes instead, keeping the
   * figure whole and undistorted; used by the preview, which has no video to
   * line up with.
   */
  fit?: 'cover' | 'contain';
}

/** Below this a landmark is a guess, and drawing it invents a limb. */
const MIN_VISIBILITY = 0.2;

/**
 * The live skeleton, drawn over the camera feed.
 *
 * Two details make it line up and stay legible:
 *
 * 1. Landmarks are normalised to the *source* frame, but the video is painted
 *    with `object-fit: cover` and is therefore cropped. The inner frame below
 *    reproduces that crop exactly (`min-width/min-height: 100%` under a fixed
 *    aspect-ratio is the cover rule), so percentage coordinates inside it land
 *    where the body actually is. Without this the skeleton drifts off the body
 *    on any viewport whose shape differs from the camera's.
 *
 * 2. Bones are SVG stretched to the frame; joints are HTML. Under a
 *    non-uniform stretch an SVG <circle> renders as an ellipse — the reason
 *    the dots are absolutely-positioned elements rather than circles.
 *
 * An empty `jointColors` means the backend could not see the whole body, so
 * every joint falls back to neutral. Drawing it all-green would tell someone
 * their form is perfect at the exact moment the coach cannot see them.
 */
export function SkeletonOverlay({
  landmarks,
  jointColors,
  mirrored = true,
  aspectRatio = 16 / 9,
  fit = 'cover',
}: SkeletonOverlayProps) {
  if (!landmarks.length) return null;

  const hasColors = Object.keys(jointColors).length > 0;

  const stateOf = (key: JointKey): JointState => {
    if (!hasColors) return 'neutral';
    const backendName = JOINT_META[key].backend;
    // The head is drawn but never evaluated — no yoga pose checks it. While
    // the rest of the body is being read, showing it neutral-grey would read
    // as a fault; it belongs to the figure, so it follows the valid colour.
    if (!backendName) return 'ok';
    const color = jointColors[backendName];
    return color ? BACKEND_COLOR_TO_STATE[color] ?? 'neutral' : 'neutral';
  };

  const pointOf = (key: JointKey) => {
    const lm = landmarks[JOINT_META[key].landmark];
    if (!lm || lm.visibility < MIN_VISIBILITY) return null;
    return { x: lm.x * 100, y: lm.y * 100 };
  };

  return (
    <div className={styles.overlay} data-mirrored={mirrored} aria-hidden="true">
      <div
        className={styles.frame}
        data-fit={fit}
        style={{ aspectRatio: String(aspectRatio) }}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.bones}>
          {EDGES.map(([a, b]) => {
            const from = pointOf(a);
            const to = pointOf(b);
            if (!from || !to) return null;
            // A bone takes the worse of its two ends, so a fault reads along
            // the whole limb rather than only at the joint that reported it.
            const state = edgeState(stateOf(a), stateOf(b));
            return (
              <line
                key={`${a}-${b}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={JOINT_STATE_COLOR[state]}
                className={styles.bone}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>

        {JOINT_KEYS.map((key) => {
          const point = pointOf(key);
          if (!point) return null;
          const state = stateOf(key);
          const color = JOINT_STATE_COLOR[state];
          const flagged = state === 'adjust' || state === 'fix';
          return (
            <span
              key={key}
              className={flagged ? `${styles.joint} zf-dot` : styles.joint}
              style={{
                left: `${point.x}%`,
                top: `${point.y}%`,
                background: color,
                boxShadow: `0 0 0 3px color-mix(in srgb, ${color} 26%, transparent)`,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
