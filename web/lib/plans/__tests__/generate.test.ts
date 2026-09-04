import { describe, expect, it } from 'vitest';
import { generatePlans } from '../generate';
import type { Experience, Goal, Minutes, OnboardingAnswers } from '../types';
import { YOGA_POSE_BY_ID } from '@/lib/data/poses';

const GOALS: Goal[] = ['balance', 'strength', 'calm'];
const EXPERIENCES: Experience[] = ['new', 'some', 'regular'];
const MINUTES: Minutes[] = [5, 10, 20];

/** Every combination of the four answers — 36 in total. */
function everyAnswer(): OnboardingAnswers[] {
  const all: OnboardingAnswers[] = [];
  for (const goal of GOALS)
    for (const experience of EXPERIENCES)
      for (const minutes of MINUTES)
        for (const floorOk of [true, false])
          all.push({ goal, experience, minutes, floorOk });
  return all;
}

const describeAnswers = (a: OnboardingAnswers) =>
  `${a.goal}/${a.experience}/${a.minutes}min/floor=${a.floorOk}`;

describe('generatePlans', () => {
  it('always returns at least two plans to choose between', () => {
    for (const answers of everyAnswer()) {
      const plans = generatePlans(answers);
      expect(plans.length, describeAnswers(answers)).toBeGreaterThanOrEqual(2);
      expect(plans.length, describeAnswers(answers)).toBeLessThanOrEqual(3);
    }
  });

  it('only ever names poses the server implements', () => {
    // A pose the backend does not know fails silently: the session sits in
    // `idle` and the user has no way to tell that from "not started".
    for (const answers of everyAnswer()) {
      for (const plan of generatePlans(answers)) {
        for (const step of plan.steps) {
          expect(YOGA_POSE_BY_ID[step.poseId], `${describeAnswers(answers)} -> ${step.poseId}`)
            .toBeDefined();
        }
      }
    }
  });

  it('never puts a floor pose in a standing-only plan', () => {
    for (const answers of everyAnswer().filter((a) => !a.floorOk)) {
      for (const plan of generatePlans(answers)) {
        for (const step of plan.steps) {
          expect(YOGA_POSE_BY_ID[step.poseId].cameraView, describeAnswers(answers))
            .toBe('front');
        }
      }
    }
  });

  it('keeps beginners away from intermediate poses', () => {
    for (const answers of everyAnswer().filter((a) => a.experience === 'new')) {
      for (const plan of generatePlans(answers)) {
        for (const step of plan.steps) {
          expect(YOGA_POSE_BY_ID[step.poseId].difficulty, describeAnswers(answers))
            .toBe('beginner');
        }
      }
    }
  });

  it('respects the time budget', () => {
    for (const answers of everyAnswer()) {
      for (const plan of generatePlans(answers)) {
        // One pose may overshoot: a plan with nothing in it is worse than a
        // plan slightly over. Beyond that the budget holds.
        const budget = answers.minutes * 60;
        expect(plan.durationSeconds, `${describeAnswers(answers)} ${plan.shape}`)
          .toBeLessThanOrEqual(budget * 1.35);
      }
    }
  });

  it('never emits a hold too short for the backend to settle on', () => {
    for (const answers of everyAnswer()) {
      for (const plan of generatePlans(answers)) {
        for (const step of plan.steps) {
          expect(step.holdSeconds).toBeGreaterThanOrEqual(8);
        }
      }
    }
  });

  it('ends every plan without a trailing rest', () => {
    for (const answers of everyAnswer()) {
      for (const plan of generatePlans(answers)) {
        expect(plan.steps.at(-1)?.restSeconds).toBe(0);
      }
    }
  });

  it('offers plans that actually differ from each other', () => {
    for (const answers of everyAnswer()) {
      const signatures = generatePlans(answers).map((p) =>
        p.steps.map((s) => `${s.poseId}:${s.holdSeconds}`).join('|')
      );
      expect(new Set(signatures).size, describeAnswers(answers)).toBe(signatures.length);
    }
  });

  it('is deterministic', () => {
    const answers: OnboardingAnswers = {
      goal: 'balance', experience: 'some', minutes: 10, floorOk: true,
    };
    expect(generatePlans(answers)).toEqual(generatePlans(answers));
  });

  it('shortens holds for beginners and not for regulars', () => {
    const base = { goal: 'calm', minutes: 20, floorOk: true } as const;
    const beginner = generatePlans({ ...base, experience: 'new' })[0];
    const regular = generatePlans({ ...base, experience: 'regular' })[0];

    const mountainHold = (plan: typeof beginner) =>
      plan.steps.find((s) => s.poseId === 'mountain')?.holdSeconds;

    // Mountain's catalog target is 15s.
    expect(mountainHold(regular)).toBe(15);
    expect(mountainHold(beginner)).toBeLessThan(15);
  });

  it('leads with the pose that best serves the stated goal', () => {
    const strength = generatePlans({
      goal: 'strength', experience: 'regular', minutes: 20, floorOk: true,
    });
    expect(strength[0].steps[0].poseId).toBe('chair');

    const balance = generatePlans({
      goal: 'balance', experience: 'regular', minutes: 20, floorOk: true,
    });
    expect(balance[0].steps[0].poseId).toBe('tree');
  });

  it('explains itself in terms of the answers given', () => {
    const standingOnly = generatePlans({
      goal: 'calm', experience: 'new', minutes: 10, floorOk: false,
    });
    for (const plan of standingOnly) {
      expect(plan.rationale).toContain('standing only');
      expect(plan.rationale.length).toBeGreaterThan(30);
    }
  });
});
