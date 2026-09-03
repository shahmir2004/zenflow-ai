/**
 * Guided flows — ordered pose sequences.
 *
 * Sequencing lives entirely here. The backend is stateless about it: the
 * client just changes the `pose` field it sends, and the backend starts a
 * fresh hold. That means a flow can be edited without touching the server.
 *
 * `holdSeconds` is optional. Omitted, the step holds to the pose's own catalog
 * target — which is what the landing copy promises ("Each carries its own hold
 * target — 15 seconds for Mountain, 25 for Warrior II"). Set it only to
 * deliberately shorten a pose for pacing.
 *
 * Every `poseId` must exist in YOGA_POSES; the catalog test asserts it.
 */

import { getYogaPose } from './poses';

export type YogaFlowLevel = 'beginner' | 'intermediate';

export interface YogaFlowStep {
  poseId: string;
  /** Omit to hold to the pose's own target. */
  holdSeconds?: number;
  /** Transition pause before the next pose. */
  restSeconds: number;
}

export interface YogaFlow {
  id: string;
  name: string;
  description: string;
  level: YogaFlowLevel;
  steps: YogaFlowStep[];
}

export const YOGA_FLOWS: YogaFlow[] = [
  {
    id: 'grounding-six',
    name: 'Grounding Six',
    description:
      'Six poses, each held to its own target. Standing throughout, then down to the floor to finish.',
    level: 'beginner',
    steps: [
      { poseId: 'mountain', restSeconds: 5 },
      { poseId: 'tree', restSeconds: 5 },
      { poseId: 'warrior_i', restSeconds: 5 },
      { poseId: 'warrior_ii', restSeconds: 6 },
      { poseId: 'triangle', restSeconds: 8 },
      { poseId: 'cobra', restSeconds: 0 },
    ],
  },
  {
    id: 'morning-wakeup',
    name: 'Morning Wake-Up',
    description:
      'A gentle standing sequence to energize the body and find your balance. Shorter holds throughout.',
    level: 'beginner',
    steps: [
      { poseId: 'mountain', holdSeconds: 12, restSeconds: 4 },
      { poseId: 'chair', holdSeconds: 15, restSeconds: 5 },
      { poseId: 'warrior_i', holdSeconds: 15, restSeconds: 5 },
      { poseId: 'tree', holdSeconds: 15, restSeconds: 4 },
      { poseId: 'mountain', holdSeconds: 12, restSeconds: 0 },
    ],
  },
  {
    id: 'standing-strength',
    name: 'Standing Strength',
    description:
      'Build leg and core strength through grounding warrior and balance poses.',
    level: 'intermediate',
    steps: [
      { poseId: 'mountain', holdSeconds: 10, restSeconds: 4 },
      { poseId: 'chair', holdSeconds: 18, restSeconds: 5 },
      { poseId: 'warrior_ii', holdSeconds: 20, restSeconds: 5 },
      { poseId: 'triangle', holdSeconds: 18, restSeconds: 5 },
      { poseId: 'tree', holdSeconds: 18, restSeconds: 0 },
    ],
  },
  {
    id: 'full-practice',
    name: 'Full Practice',
    description:
      'A complete flow moving from standing poses to the floor and back. Turn side-on for the last two.',
    level: 'intermediate',
    steps: [
      { poseId: 'mountain', holdSeconds: 10, restSeconds: 4 },
      { poseId: 'warrior_i', holdSeconds: 15, restSeconds: 5 },
      { poseId: 'warrior_ii', holdSeconds: 18, restSeconds: 5 },
      { poseId: 'triangle', holdSeconds: 15, restSeconds: 5 },
      { poseId: 'tree', holdSeconds: 15, restSeconds: 6 },
      { poseId: 'downward_dog', holdSeconds: 18, restSeconds: 6 },
      { poseId: 'cobra', holdSeconds: 12, restSeconds: 5 },
      { poseId: 'mountain', holdSeconds: 12, restSeconds: 0 },
    ],
  },
];

/** The flow every "Begin a session" CTA opens. */
export const DEFAULT_FLOW_ID = 'grounding-six';

export function getYogaFlow(id: string | null | undefined): YogaFlow | undefined {
  if (!id) return undefined;
  return YOGA_FLOWS.find((f) => f.id === id);
}

export function defaultFlow(): YogaFlow {
  return getYogaFlow(DEFAULT_FLOW_ID) ?? YOGA_FLOWS[0];
}

/** Resolve a step's hold, falling back to the pose's own catalog target. */
export function stepHoldSeconds(step: YogaFlowStep): number {
  if (typeof step.holdSeconds === 'number') return step.holdSeconds;
  return getYogaPose(step.poseId)?.holdTargetSeconds ?? 20;
}

/** Total time a flow takes if every hold lands first try — holds plus rests. */
export function flowDurationSeconds(flow: YogaFlow): number {
  return flow.steps.reduce(
    (total, step) => total + stepHoldSeconds(step) + step.restSeconds,
    0
  );
}
