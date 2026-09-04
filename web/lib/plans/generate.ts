import { YOGA_POSES, type YogaPose } from '@/lib/data/poses';
import type { ResolvedStep } from '@/lib/data/flowEngine';
import type {
  Experience,
  Goal,
  Minutes,
  OnboardingAnswers,
  PlanCandidate,
  Shape,
} from './types';

/**
 * Builds a practice plan from four answers.
 *
 * Pure: no network, no model, no randomness. The same answers always produce
 * the same plans, which is what makes it testable and what makes the rationale
 * honest — the text below describes decisions the code actually made.
 *
 * It also cannot invent a pose. Everything comes from YOGA_POSES, whose ids are
 * asserted against the server's catalog by lib/data/__tests__/catalog.test.ts.
 * A plan naming a pose the server does not implement would sit in `idle`
 * forever, with nothing on screen to explain why.
 */

/** How much each pose serves each goal. 0 excludes it from that goal entirely. */
const GOAL_WEIGHTS: Record<Goal, Record<string, number>> = {
  balance: {
    tree: 10, warrior_i: 7, warrior_ii: 7, triangle: 6,
    mountain: 5, chair: 3, downward_dog: 2, cobra: 1,
  },
  strength: {
    chair: 10, warrior_ii: 9, warrior_i: 8, downward_dog: 7,
    triangle: 5, tree: 4, mountain: 3, cobra: 3,
  },
  calm: {
    cobra: 9, downward_dog: 8, mountain: 8, triangle: 6,
    tree: 5, warrior_i: 4, warrior_ii: 3, chair: 2,
  },
};

/**
 * Holds scale with experience. A beginner asked to hold Warrior II for the
 * full 25 seconds mostly learns that they cannot — and the backend reads a
 * collapsing pose as a fault rather than as fatigue.
 */
const HOLD_FACTOR: Record<Experience, number> = { new: 0.7, some: 0.85, regular: 1 };

/** Rest between poses. Longer for beginners, and longer after hard poses. */
const BASE_REST: Record<Experience, number> = { new: 8, some: 6, regular: 5 };

/** How much of the time budget each shape aims to fill. */
const SHAPE_FILL: Record<Shape, number> = { short: 0.62, balanced: 0.85, full: 1 };

/**
 * How many poses each shape takes.
 *
 * A budget alone is not enough to tell the shapes apart. Once the eligible
 * pose pool runs out — which it does for a beginner practising standing-only,
 * where just three poses qualify — every shape takes all of them and produces
 * the identical sequence. Capping the count keeps "short" genuinely shorter
 * than "full" even when there is time to spare.
 */
const MAX_STEPS: Record<Minutes, Record<Shape, number>> = {
  5: { short: 2, balanced: 3, full: 4 },
  10: { short: 3, balanced: 4, full: 6 },
  20: { short: 4, balanced: 6, full: 8 },
};

/**
 * ...and as a fraction of what is actually available.
 *
 * The fixed caps above only separate the shapes while they are smaller than
 * the pose pool. A beginner practising standing-only has just three eligible
 * poses, so every cap of three or more takes all of them and the shapes
 * collapse into one plan again. Taking whichever is smaller keeps them apart
 * at both ends.
 */
const SHAPE_POSE_RATIO: Record<Shape, number> = { short: 0.5, balanced: 0.75, full: 1 };

function maxStepsFor(shape: Shape, minutes: Minutes, poolSize: number): number {
  const byTime = MAX_STEPS[minutes][shape];
  const byPool = Math.ceil(poolSize * SHAPE_POSE_RATIO[shape]);
  // Two poses is the floor: one pose is a single hold, not a practice.
  return Math.max(2, Math.min(byTime, byPool));
}

const SHAPE_NAMES: Record<Goal, Record<Shape, string>> = {
  balance: { short: 'Steady Start', balanced: 'Finding Balance', full: 'Rooted' },
  strength: { short: 'Quick Strength', balanced: 'Standing Strong', full: 'Full Build' },
  calm: { short: 'Short Unwind', balanced: 'Slow Down', full: 'Long Unwind' },
};

const SHAPE_DESCRIPTIONS: Record<Shape, string> = {
  short: 'The one you will actually do on a busy day.',
  balanced: 'Enough to feel like a practice, short enough to repeat.',
  full: 'Every minute you said you had.',
};

function holdFor(pose: YogaPose, experience: Experience): number {
  const scaled = Math.round(pose.holdTargetSeconds * HOLD_FACTOR[experience]);
  // Below about eight seconds a hold stops being a hold: there is not enough
  // time for the backend's debounce to settle and report a clean result.
  return Math.max(8, scaled);
}

function restFor(pose: YogaPose, experience: Experience): number {
  const extra = pose.difficulty === 'intermediate' ? 2 : 0;
  return BASE_REST[experience] + extra;
}

/** The poses this person can actually do, best first. */
function eligiblePoses(answers: OnboardingAnswers): YogaPose[] {
  const weights = GOAL_WEIGHTS[answers.goal];

  return YOGA_POSES.filter((pose) => {
    // Floor poses need a side-on camera at floor height and are the least
    // reliably detected of the eight. If the floor is out, they are out.
    if (!answers.floorOk && pose.cameraView === 'side') return false;
    if (answers.experience === 'new' && pose.difficulty === 'intermediate') return false;
    return (weights[pose.id] ?? 0) > 0;
  }).sort((a, b) => (weights[b.id] ?? 0) - (weights[a.id] ?? 0));
}

function buildSteps(
  poses: YogaPose[],
  answers: OnboardingAnswers,
  budgetSeconds: number,
  maxSteps: number
): ResolvedStep[] {
  const steps: ResolvedStep[] = [];
  let spent = 0;

  for (const pose of poses) {
    if (steps.length >= maxSteps) break;
    const holdSeconds = holdFor(pose, answers.experience);
    const restSeconds = restFor(pose, answers.experience);
    // Always take at least one pose, even on the tightest budget — a plan with
    // nothing in it is not a plan.
    if (spent + holdSeconds > budgetSeconds && steps.length > 0) break;
    steps.push({ poseId: pose.id, holdSeconds, restSeconds });
    spent += holdSeconds + restSeconds;
  }

  // The last pose has nothing to transition to.
  if (steps.length > 0) steps[steps.length - 1].restSeconds = 0;
  return steps;
}

function durationOf(steps: ResolvedStep[]): number {
  return steps.reduce((total, step) => total + step.holdSeconds + step.restSeconds, 0);
}

/**
 * Explains the plan in terms of what the person actually answered.
 *
 * A plan that says why it looks the way it does is worth more than one that
 * just appears — it is the only way to tell a tailored plan from a random one.
 */
function buildRationale(
  answers: OnboardingAnswers,
  steps: ResolvedStep[],
  shape: Shape
): string {
  const parts: string[] = [];

  const goalPhrase: Record<Goal, string> = {
    balance: 'Built around balance work, so the standing poses carry the session',
    strength: 'Weighted toward the poses that build leg and core strength',
    calm: 'Weighted toward slower, opening poses',
  };
  parts.push(goalPhrase[answers.goal]);

  if (!answers.floorOk) {
    parts.push('standing only, because you said the floor is out');
  }

  if (answers.experience === 'new') {
    parts.push('with holds shorter than the full targets while the poses are new');
  } else if (answers.experience === 'regular') {
    parts.push('with holds at each pose’s full target');
  }

  const minutes = Math.max(1, Math.round(durationOf(steps) / 60));
  const shapePhrase: Record<Shape, string> = {
    short: `about ${minutes} minutes — the shortest version that still counts`,
    balanced: `about ${minutes} minutes across ${steps.length} poses`,
    full: `the full ${minutes} minutes you said you had`,
  };
  parts.push(shapePhrase[shape]);

  return `${parts.join(', ')}.`;
}

/**
 * Two or three plans to choose from.
 *
 * Three when the time budget leaves room for meaningfully different lengths;
 * two when it does not — offering a "short" and a "full" that come out
 * identical is worse than offering one.
 */
export function generatePlans(answers: OnboardingAnswers): PlanCandidate[] {
  const poses = eligiblePoses(answers);
  if (poses.length === 0) return [];

  const budget = answers.minutes * 60;
  const shapes: Shape[] =
    answers.minutes === 5 ? ['short', 'full'] : ['short', 'balanced', 'full'];

  const candidates: PlanCandidate[] = [];

  for (const shape of shapes) {
    const steps = buildSteps(
      poses,
      answers,
      budget * SHAPE_FILL[shape],
      maxStepsFor(shape, answers.minutes, poses.length)
    );
    if (steps.length === 0) continue;

    // Drop a shape that produced the same sequence as one already offered.
    const signature = steps.map((s) => `${s.poseId}:${s.holdSeconds}`).join('|');
    const duplicate = candidates.some(
      (c) => c.steps.map((s) => `${s.poseId}:${s.holdSeconds}`).join('|') === signature
    );
    if (duplicate) continue;

    candidates.push({
      shape,
      name: SHAPE_NAMES[answers.goal][shape],
      description: SHAPE_DESCRIPTIONS[shape],
      rationale: buildRationale(answers, steps, shape),
      steps,
      durationSeconds: durationOf(steps),
    });
  }

  return candidates;
}
