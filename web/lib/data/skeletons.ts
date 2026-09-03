/**
 * Skeleton topology and per-pose joint coordinates.
 *
 * One dataset serves three surfaces:
 *   1. the hero's settle animation (Tree),
 *   2. the pose-library and detail-sheet figures (all 8),
 *   3. the How-it-works sticky mock (Warrior II).
 *
 * Coordinates are hand-authored percentages of the figure's box, ported from
 * the design prototype (design_handoff_zenflow_ai/design/ZenFlow AI.dc.html).
 * They approximate each pose for illustration — the *live* overlay never uses
 * them, it draws real MediaPipe landmarks.
 *
 * The joint keys and edge list ARE shared with the live overlay, though: the
 * library figure and the skeleton drawn over your body are deliberately the
 * same 13 dots and 12 bones, so the library teaches you to read the live view.
 */

export type JointKey =
  | 'head'
  | 'ls' | 'rs'
  | 'le' | 're'
  | 'lw' | 'rw'
  | 'lh' | 'rh'
  | 'lk' | 'rk'
  | 'la' | 'ra';

/** [x, y] as percentages of the figure box. */
export type Point = readonly [number, number];
export type Skeleton = Record<JointKey, Point>;

/** Neutral standing figure. Every pose is expressed as a diff against this. */
export const BASE_SKELETON: Skeleton = {
  head: [50, 13],
  ls: [43, 27], rs: [57, 27],
  le: [39, 38], re: [61, 38],
  lw: [36, 49], rw: [64, 49],
  lh: [45.5, 50], rh: [54.5, 50],
  lk: [44.5, 69], rk: [55.5, 69],
  la: [44, 88], ra: [56, 88],
};

/**
 * The 12 bones. `head` is intentionally unconnected — it reads as a floating
 * dot, which keeps the figure abstract rather than cartoonish.
 */
export const EDGES: readonly (readonly [JointKey, JointKey])[] = [
  ['ls', 'rs'],
  ['ls', 'le'], ['le', 'lw'],
  ['rs', 're'], ['re', 'rw'],
  ['ls', 'lh'], ['rs', 'rh'],
  ['lh', 'rh'],
  ['lh', 'lk'], ['rh', 'rk'],
  ['lk', 'la'], ['rk', 'ra'],
];

export const JOINT_KEYS = Object.keys(BASE_SKELETON) as JointKey[];

/** How a joint is currently reading. Mirrors the backend's joint_colors. */
export type JointState = 'ok' | 'adjust' | 'fix' | 'neutral';

export const JOINT_STATE_COLOR: Record<JointState, string> = {
  ok: 'var(--form-valid)',
  adjust: 'var(--form-adjust)',
  fix: 'var(--form-fix)',
  neutral: 'var(--form-neutral)',
};

/** The backend's colour vocabulary → ours. */
export const BACKEND_COLOR_TO_STATE: Record<string, JointState> = {
  green: 'ok',
  yellow: 'adjust',
  red: 'fix',
};

/**
 * Joint key → the snake_case name the backend uses in `joint_colors`, and the
 * MediaPipe landmark index it is drawn from. `head` maps to landmark 0 (nose);
 * the backend never colours it, so it always renders in the figure's base
 * state.
 */
export const JOINT_META: Record<
  JointKey,
  { landmark: number; backend: string | null; label: string }
> = {
  head: { landmark: 0, backend: null, label: 'Head' },
  ls: { landmark: 11, backend: 'left_shoulder', label: 'Left shoulder' },
  rs: { landmark: 12, backend: 'right_shoulder', label: 'Right shoulder' },
  le: { landmark: 13, backend: 'left_elbow', label: 'Left elbow' },
  re: { landmark: 14, backend: 'right_elbow', label: 'Right elbow' },
  lw: { landmark: 15, backend: 'left_wrist', label: 'Left wrist' },
  rw: { landmark: 16, backend: 'right_wrist', label: 'Right wrist' },
  lh: { landmark: 23, backend: 'left_hip', label: 'Left hip' },
  rh: { landmark: 24, backend: 'right_hip', label: 'Right hip' },
  lk: { landmark: 25, backend: 'left_knee', label: 'Left knee' },
  rk: { landmark: 26, backend: 'right_knee', label: 'Right knee' },
  la: { landmark: 27, backend: 'left_ankle', label: 'Left ankle' },
  ra: { landmark: 28, backend: 'right_ankle', label: 'Right ankle' },
};

/**
 * Per-pose joint overrides, and the joints the illustration flags. The flags
 * are illustrative — they show what the coach watches for in that pose, which
 * is why Chair flags both knees and Warrior II flags the front knee.
 */
interface PoseSkeletonSpec {
  over: Partial<Record<JointKey, Point>>;
  flags: Partial<Record<JointKey, Exclude<JointState, 'neutral'>>>;
}

export const POSE_SKELETONS: Record<string, PoseSkeletonSpec> = {
  mountain: {
    over: {},
    flags: {},
  },
  tree: {
    over: {
      rk: [67, 66], ra: [49, 67],
      lw: [50, 10], rw: [50, 10],
      le: [44, 20], re: [56, 20],
    },
    flags: { rk: 'adjust' },
  },
  warrior_i: {
    over: {
      lw: [45, 7], rw: [55, 7],
      le: [42, 18], re: [58, 18],
      lk: [33, 68], la: [27, 88],
      rk: [66, 66], ra: [76, 88],
    },
    flags: {},
  },
  warrior_ii: {
    over: {
      le: [30, 28], lw: [16, 28],
      re: [70, 28], rw: [84, 28],
      lk: [31, 70], la: [23, 89],
      rk: [68, 66], ra: [79, 89],
    },
    flags: { lk: 'fix' },
  },
  chair: {
    over: {
      lw: [44, 8], rw: [56, 8],
      le: [41, 20], re: [59, 20],
      lh: [46, 56], rh: [54, 56],
      lk: [43, 72], rk: [57, 72],
    },
    flags: { lk: 'adjust', rk: 'adjust' },
  },
  triangle: {
    over: {
      ls: [38, 38], rs: [50, 30],
      le: [34, 26], lw: [31, 14],
      re: [54, 44], rw: [58, 58],
      lh: [42, 52], rh: [52, 50],
      lk: [30, 70], la: [24, 89],
      rk: [64, 70], ra: [74, 89],
    },
    flags: {},
  },
  downward_dog: {
    over: {
      head: [24, 42],
      ls: [30, 44], rs: [31, 45],
      le: [26, 60], re: [27, 61],
      lw: [22, 80], rw: [23, 81],
      lh: [62, 24], rh: [63, 25],
      lk: [72, 52], rk: [73, 53],
      la: [80, 82], ra: [81, 83],
    },
    flags: { lw: 'adjust', rw: 'adjust' },
  },
  cobra: {
    over: {
      head: [26, 44],
      ls: [33, 52], rs: [34, 53],
      le: [30, 66], re: [31, 67],
      lw: [27, 80], rw: [28, 81],
      lh: [54, 78], rh: [55, 79],
      lk: [68, 80], rk: [69, 81],
      la: [82, 80], ra: [83, 81],
    },
    flags: { lh: 'adjust', rh: 'adjust' },
  },
};

/** Resolve a pose label to its full 13-joint figure. */
export function skeletonFor(poseId: string): Skeleton {
  const spec = POSE_SKELETONS[poseId];
  if (!spec) return { ...BASE_SKELETON };
  return { ...BASE_SKELETON, ...spec.over };
}

export function flagsFor(poseId: string): Partial<Record<JointKey, JointState>> {
  return POSE_SKELETONS[poseId]?.flags ?? {};
}

/**
 * A bone takes the worse of its two endpoints, so a fault reads along the limb
 * it belongs to rather than only at the joint.
 */
const SEVERITY: Record<JointState, number> = { neutral: 0, ok: 1, adjust: 2, fix: 3 };

export function edgeState(a: JointState, b: JointState): JointState {
  return SEVERITY[a] >= SEVERITY[b] ? a : b;
}

/**
 * Which quadrant a joint sits in relative to the figure's centre. The hero's
 * dots fly in from the direction they belong to, so the settle reads as a
 * body assembling rather than a scatter converging.
 */
export function quadrantOf([x, y]: Point): 1 | 2 | 3 | 4 {
  if (y < 50) return x < 50 ? 1 : 2;
  return x < 50 ? 3 : 4;
}

/** Outward offset (px) used as the settle animation's start position. */
export function driftOffset(point: Point): { dx: number; dy: number } {
  const q = quadrantOf(point);
  const magnitude = 28;
  const dx = q === 1 || q === 3 ? -magnitude : magnitude;
  const dy = q === 1 || q === 2 ? -magnitude : magnitude;
  return { dx, dy };
}
