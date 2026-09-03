import { describe, expect, it } from 'vitest';
import { YOGA_POSES, YOGA_POSE_BY_ID, poseInitials } from '../poses';
import { YOGA_FLOWS, DEFAULT_FLOW_ID, getYogaFlow, stepHoldSeconds } from '../flows';
import {
  BASE_SKELETON,
  EDGES,
  JOINT_KEYS,
  JOINT_META,
  POSE_SKELETONS,
  edgeState,
  skeletonFor,
} from '../skeletons';
import { advancePhase, buildSteps, tallyCorrection, topCorrections } from '../flowEngine';

/**
 * The backend is the authority on labels, camera views and hold targets. These
 * values are duplicated here from exercises/yoga_registry.py deliberately: a
 * test that fetched them would pass whenever the backend was unreachable,
 * which is exactly when drift goes unnoticed.
 *
 * When the backend adds or retunes a pose, this table changes with it —
 * and the failure tells you which files need updating.
 */
const BACKEND_CATALOG = {
  mountain: { hold: 15, view: 'front', sanskrit: 'Tadasana' },
  tree: { hold: 20, view: 'front', sanskrit: 'Vrksasana' },
  warrior_i: { hold: 20, view: 'front', sanskrit: 'Virabhadrasana I' },
  warrior_ii: { hold: 25, view: 'front', sanskrit: 'Virabhadrasana II' },
  chair: { hold: 20, view: 'front', sanskrit: 'Utkatasana' },
  triangle: { hold: 20, view: 'front', sanskrit: 'Trikonasana' },
  downward_dog: { hold: 20, view: 'side', sanskrit: 'Adho Mukha Svanasana' },
  cobra: { hold: 15, view: 'side', sanskrit: 'Bhujangasana' },
} as const;

describe('pose catalog parity with the backend', () => {
  it('covers exactly the backend’s labels', () => {
    expect(YOGA_POSES.map((p) => p.id).sort()).toEqual(
      Object.keys(BACKEND_CATALOG).sort()
    );
  });

  it.each(Object.entries(BACKEND_CATALOG))(
    '%s matches the backend’s hold target, camera view and name',
    (label, expected) => {
      const pose = YOGA_POSE_BY_ID[label];
      expect(pose, `${label} missing from the catalog`).toBeDefined();
      expect(pose.holdTargetSeconds).toBe(expected.hold);
      expect(pose.cameraView).toBe(expected.view);
      expect(pose.sanskrit).toBe(expected.sanskrit);
    }
  );

  it('gives every pose the content the UI needs', () => {
    for (const pose of YOGA_POSES) {
      expect(pose.setupSteps.length, `${pose.id} setup steps`).toBeGreaterThan(0);
      expect(pose.cues.length, `${pose.id} coach cues`).toBeGreaterThan(0);
      expect(pose.holdCue).not.toBe('');
      expect(pose.transitionCue).not.toBe('');
      expect(pose.description).not.toBe('');
      // The control bar chip has room for roughly this much.
      expect(pose.short.length, `${pose.id} short name`).toBeLessThanOrEqual(10);
    }
  });

  it('derives readable badge initials', () => {
    expect(poseInitials(YOGA_POSE_BY_ID.warrior_ii)).toBe('W2');
    expect(poseInitials(YOGA_POSE_BY_ID.warrior_i)).toBe('W1');
    expect(poseInitials(YOGA_POSE_BY_ID.tree)).toBe('TP');
  });
});

describe('flows', () => {
  it('only references poses that exist', () => {
    for (const flow of YOGA_FLOWS) {
      for (const step of flow.steps) {
        expect(YOGA_POSE_BY_ID[step.poseId], `${flow.id} → ${step.poseId}`).toBeDefined();
      }
    }
  });

  it('has a resolvable default flow', () => {
    expect(getYogaFlow(DEFAULT_FLOW_ID)).toBeDefined();
  });

  it('falls back to the pose’s own target when a step sets no hold', () => {
    // The landing copy promises exactly this: "Each carries its own hold
    // target — 15 seconds for Mountain, 25 for Warrior II."
    const grounding = getYogaFlow('grounding-six')!;
    const mountain = grounding.steps.find((s) => s.poseId === 'mountain')!;
    const warrior = grounding.steps.find((s) => s.poseId === 'warrior_ii')!;
    expect(stepHoldSeconds(mountain)).toBe(15);
    expect(stepHoldSeconds(warrior)).toBe(25);
  });

  it('the default flow is the six the landing page advertises', () => {
    expect(getYogaFlow('grounding-six')!.steps).toHaveLength(6);
  });
});

describe('skeleton data', () => {
  it('has a figure for every pose', () => {
    for (const pose of YOGA_POSES) {
      expect(POSE_SKELETONS[pose.id], `${pose.id} figure`).toBeDefined();
    }
  });

  it('resolves overrides against the base figure', () => {
    const tree = skeletonFor('tree');
    // Tree lifts one foot; the standing ankle is untouched.
    expect(tree.ra).not.toEqual(BASE_SKELETON.ra);
    expect(tree.la).toEqual(BASE_SKELETON.la);
  });

  it('only draws bones between joints that exist', () => {
    for (const [a, b] of EDGES) {
      expect(JOINT_KEYS).toContain(a);
      expect(JOINT_KEYS).toContain(b);
    }
  });

  it('maps every joint to a MediaPipe landmark index', () => {
    for (const key of JOINT_KEYS) {
      const meta = JOINT_META[key];
      expect(meta.landmark).toBeGreaterThanOrEqual(0);
      expect(meta.landmark).toBeLessThan(33);
    }
  });

  it('uses snake_case backend names matching JointName', () => {
    // These are the twelve the yoga poses actually colour.
    const named = JOINT_KEYS.map((k) => JOINT_META[k].backend).filter(Boolean);
    expect(named).toHaveLength(12);
    for (const name of named) {
      expect(name).toMatch(/^(left|right)_(shoulder|elbow|wrist|hip|knee|ankle)$/);
    }
  });

  it('a bone takes the worse of its two endpoints', () => {
    expect(edgeState('ok', 'fix')).toBe('fix');
    expect(edgeState('adjust', 'ok')).toBe('adjust');
    expect(edgeState('fix', 'adjust')).toBe('fix');
    expect(edgeState('ok', 'ok')).toBe('ok');
  });
});

describe('flow engine', () => {
  it('normalises a single pose into one step', () => {
    expect(buildSteps({ mode: 'single', poseId: 'tree', holdSeconds: 20 })).toEqual([
      { poseId: 'tree', holdSeconds: 20, restSeconds: 0 },
    ]);
  });

  it('rests between steps but completes on the last one', () => {
    expect(advancePhase('holding', 'HOLD_DONE', true)).toBe('rest');
    expect(advancePhase('holding', 'HOLD_DONE', false)).toBe('complete');
  });

  it('returns to setup when a hold collapses', () => {
    expect(advancePhase('holding', 'POSE_LOST', true)).toBe('setup');
  });

  it('ranks corrections by how often they came up', () => {
    let tally = new Map();
    tally = tallyCorrection(tally, 'Bend the front knee', 'warrior_ii', 'Warrior II');
    tally = tallyCorrection(tally, 'Bend the front knee', 'warrior_ii', 'Warrior II');
    tally = tallyCorrection(tally, 'Root down', 'tree', 'Tree Pose');

    const top = topCorrections(tally, 3);
    expect(top[0]).toMatchObject({ correction: 'Bend the front knee', count: 2 });
    expect(top[1]).toMatchObject({ correction: 'Root down', count: 1 });
  });

  it('keeps the same correction separate per pose', () => {
    let tally = new Map();
    tally = tallyCorrection(tally, 'Straighten your legs', 'mountain', 'Mountain Pose');
    tally = tallyCorrection(tally, 'Straighten your legs', 'triangle', 'Triangle Pose');
    expect(topCorrections(tally)).toHaveLength(2);
  });
});
