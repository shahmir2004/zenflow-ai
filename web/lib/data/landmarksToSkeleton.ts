import type { PoseLandmark } from '@/lib/contracts/yoga';
import {
  BACKEND_COLOR_TO_STATE,
  BASE_SKELETON,
  JOINT_KEYS,
  JOINT_META,
  type JointKey,
  type JointState,
  type Point,
  type Skeleton,
} from './skeletons';

/**
 * Turns a captured frame into the 13-joint figure PoseFigure draws.
 *
 * The library figures and the live overlay already share this topology; this
 * is what lets a recorded moment be replayed in the same visual language,
 * from 33 stored floats and no image at all.
 *
 * MediaPipe's normalised coordinates are 0-1 across the camera frame, while
 * the figure space is a percentage box. A body rarely fills the frame, so the
 * points are renormalised to their own bounding box — otherwise a person
 * standing well back replays as a figure huddled in the middle of the card.
 */
export interface ReplayFigure {
  skeleton: Skeleton;
  /** Tight crop around the body, so it fills whatever box it is drawn in. */
  viewBox: string;
}

export function landmarksToSkeleton(landmarks: PoseLandmark[]): ReplayFigure | null {
  if (landmarks.length !== 33) return null;

  const raw: Partial<Record<JointKey, Point>> = {};
  for (const key of JOINT_KEYS) {
    const landmark = landmarks[JOINT_META[key].landmark];
    if (!landmark) continue;
    raw[key] = [landmark.x, landmark.y];
  }

  const points = Object.values(raw) as Point[];
  if (points.length < JOINT_KEYS.length) return null;

  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // A degenerate box means every joint landed on one spot — not a pose.
  const width = maxX - minX;
  const height = maxY - minY;
  if (width <= 0.001 || height <= 0.001) return null;

  /*
   * Fit inside the figure box, preserving aspect so the pose is not stretched
   * into a shape the person never made.
   *
   * The height allowance is generous and the width one is not, because
   * PoseFigure renders a square viewBox with xMidYMid meet: a standing body
   * is constrained by height, and letting it use nearly all of that is what
   * makes thirteen joints legible at thumbnail size.
   */
  const scale = Math.min(70 / (width * 100), 96 / (height * 100));
  const drawnWidth = width * 100 * scale;
  const drawnHeight = height * 100 * scale;
  const offsetX = (100 - drawnWidth) / 2;
  const offsetY = (100 - drawnHeight) / 2;

  const skeleton = { ...BASE_SKELETON } as Record<JointKey, Point>;
  for (const key of JOINT_KEYS) {
    const point = raw[key];
    if (!point) continue;
    skeleton[key] = [
      offsetX + (point[0] - minX) * 100 * scale,
      offsetY + (point[1] - minY) * 100 * scale,
    ];
  }

  /*
   * A margin wide enough for the joint dots and their haloes, which are drawn
   * in viewBox units and would otherwise be clipped at the body's edge.
   */
  const margin = 7;
  const viewBox = [
    offsetX - margin,
    offsetY - margin,
    drawnWidth + margin * 2,
    drawnHeight + margin * 2,
  ].join(' ');

  return { skeleton, viewBox };
}

/** The backend's joint_colors, in the figure's own vocabulary. */
export function jointColorsToFlags(
  jointColors: Record<string, string>
): Partial<Record<JointKey, JointState>> {
  const flags: Partial<Record<JointKey, JointState>> = {};
  for (const key of JOINT_KEYS) {
    const backend = JOINT_META[key].backend;
    if (!backend) continue;
    const state = BACKEND_COLOR_TO_STATE[jointColors[backend]];
    if (state) flags[key] = state;
  }
  return flags;
}
