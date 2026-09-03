/**
 * Pure (React-free) decision logic for the guided flow controller.
 *
 * Kept separate from the useYogaFlow hook so phase transitions and step
 * resolution are unit-testable in a plain Node environment.
 */

export type FlowPhase = 'idle' | 'setup' | 'holding' | 'rest' | 'complete';
export type FlowEvent = 'POSE_REACHED' | 'HOLD_DONE' | 'POSE_LOST' | 'REST_DONE';

export interface ResolvedStep {
  poseId: string;
  holdSeconds: number;
  restSeconds: number;
}

export type BuildStepsParams =
  | { mode: 'single'; poseId: string; holdSeconds: number }
  | { mode: 'flow'; steps: ResolvedStep[] };

/** Normalize a single-pose session or a flow into one ordered step list. */
export function buildSteps(params: BuildStepsParams): ResolvedStep[] {
  if (params.mode === 'single') {
    return [
      { poseId: params.poseId, holdSeconds: params.holdSeconds, restSeconds: 0 },
    ];
  }
  return params.steps.map((s) => ({ ...s }));
}

/**
 * The flow's phase state machine. `hasNextStep` decides whether a finished
 * hold rests before the next pose, or ends the session.
 *
 *   setup   --POSE_REACHED--> holding
 *   holding --HOLD_DONE-----> rest (if next) | complete (if last)
 *   holding --POSE_LOST-----> setup
 *   rest    --REST_DONE-----> setup   (caller advances the step index first)
 */
export function advancePhase(
  phase: FlowPhase,
  event: FlowEvent,
  hasNextStep: boolean
): FlowPhase {
  switch (phase) {
    case 'setup':
      if (event === 'POSE_REACHED') return 'holding';
      return phase;
    case 'holding':
      if (event === 'HOLD_DONE') return hasNextStep ? 'rest' : 'complete';
      if (event === 'POSE_LOST') return 'setup';
      return phase;
    case 'rest':
      if (event === 'REST_DONE') return 'setup';
      return phase;
    default:
      return phase;
  }
}

/** Hold progress (0..1) toward the desired hold for the current step. */
export function holdProgress(holdSeconds: number, desiredHoldSeconds: number): number {
  if (desiredHoldSeconds <= 0) return 1;
  return Math.min(1, Math.max(0, holdSeconds / desiredHoldSeconds));
}

/* ────────────────────────────────────────────────────────────────────────
   Correction tally — powers the summary's "To fix next".
   ──────────────────────────────────────────────────────────────────── */

export interface CorrectionCount {
  correction: string;
  poseId: string;
  poseName: string;
  count: number;
}

/**
 * Accumulates how often each correction came up, per pose.
 *
 * Only the *leading* correction is counted — that is the one the user was
 * shown and told, so it is the one that actually cost them the hold. Counting
 * every violation would inflate poses that fail several checks at once and
 * misreport what to work on.
 */
export function tallyCorrection(
  tally: Map<string, CorrectionCount>,
  correction: string,
  poseId: string,
  poseName: string
): Map<string, CorrectionCount> {
  if (!correction) return tally;
  const key = `${poseId}::${correction}`;
  const existing = tally.get(key);
  if (existing) {
    existing.count += 1;
  } else {
    tally.set(key, { correction, poseId, poseName, count: 1 });
  }
  return tally;
}

/** Top corrections, most frequent first. */
export function topCorrections(
  tally: Map<string, CorrectionCount>,
  limit = 3
): CorrectionCount[] {
  return [...tally.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}
