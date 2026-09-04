/**
 * The yoga WebSocket contract.
 *
 * Mirrors `YogaPoseResponse` in
 * form-checking-backend/backend/api/yoga_routes.py. If a field changes there,
 * it changes here — these types are the only place the wire format is written
 * down on the client.
 *
 * See form-checking-backend/docs/YOGA_API.md §3 for the full protocol.
 */

/** One MediaPipe pose landmark. `x`/`y` are normalised 0–1; `y` grows downward. */
export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
}

export type YogaState = 'idle' | 'adjusting' | 'holding';
export type YogaCameraView = 'front' | 'side';
export type JointColor = 'green' | 'yellow' | 'red';

/** Client → server, one message per frame. */
export interface YogaFrame {
  landmarks: PoseLandmark[];
  /** A label from GET /api/yoga/poses. Sent every frame; it is idempotent. */
  pose: string;
  /** Echoed back verbatim — used to measure round-trip latency. */
  timestamp?: number;
}

/** Server → client, one response per accepted frame. */
export interface YogaResponse {
  /** `idle` = no pose selected. `adjusting` = selected, body not yet correct. */
  state: YogaState;
  current_pose: string | null;
  pose_display: string;
  camera_view: YogaCameraView;
  /** Frame-level verdict — true exactly when `violations` is empty. */
  is_in_pose: boolean;
  /** Wall-clock seconds of the current continuous hold. */
  hold_seconds: number;
  hold_target_seconds: number;
  /** min(1, hold_seconds / target) — drives the ring. */
  hold_progress: number;
  /** Latches true once the target is reached and stays true for the hold. */
  hold_complete: boolean;
  /** True on exactly ONE frame per hold. Fire the chime here. */
  just_completed: boolean;
  violations: string[];
  corrections: string[];
  correction_message: string;
  /** Snake_case joint names. Empty means the body was not fully visible. */
  joint_colors: Record<string, JointColor>;
  /** Mean visibility of the pose's required joints. Below ~0.5 is unreliable. */
  confidence: number;
  timestamp: number;
}

/** One entry of GET /api/yoga/poses. */
export interface YogaPoseInfo {
  label: string;
  display_name: string;
  sanskrit: string;
  camera_view: YogaCameraView;
  target_hold_seconds: number;
}

export interface YogaPoseCatalog {
  poses: YogaPoseInfo[];
}

/**
 * The backend short-circuits geometry evaluation when a required joint is
 * missing or below VISIBILITY_THRESHOLD, and says so with this exact string.
 * That is a framing problem, not a form problem, and the UI must not present
 * it as "your knee is wrong".
 */
export const NOT_VISIBLE_VIOLATION = 'Body not fully visible';

/**
 * The body is inside the picture but cannot be read — turned away from the
 * lens, poorly lit, or limbs hidden behind each other.
 *
 * This is a different problem from the one above and takes different advice.
 * Telling someone to step back when they are already fully in shot sends them
 * fixing the wrong thing, and they end up further away and no more readable.
 */
export const OCCLUDED_VIOLATION = 'Body not clearly visible';

/** Below this, the backend's own docs say to treat feedback as unreliable. */
export const LOW_CONFIDENCE_THRESHOLD = 0.5;

export function isFramingProblem(response: YogaResponse | null): boolean {
  return framingKind(response) !== null;
}

/** Which framing problem, if any — so the UI can give the matching advice. */
export type FramingKind = 'out-of-frame' | 'unreadable';

export function framingKind(response: YogaResponse | null): FramingKind | null {
  if (!response) return null;
  if (response.violations.includes(NOT_VISIBLE_VIOLATION)) return 'out-of-frame';
  if (response.violations.includes(OCCLUDED_VIOLATION)) return 'unreadable';
  // An empty joint_colors map with an active pose means the same thing. The
  // cause is unknowable from here, so this takes the more cautious wording.
  if (
    response.current_pose !== null &&
    Object.keys(response.joint_colors).length === 0 &&
    !response.is_in_pose
  ) {
    return 'unreadable';
  }
  return null;
}
