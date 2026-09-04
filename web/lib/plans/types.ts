import type { ResolvedStep } from '@/lib/data/flowEngine';

export type Goal = 'balance' | 'strength' | 'calm';
export type Experience = 'new' | 'some' | 'regular';
export type Minutes = 5 | 10 | 20;

export interface OnboardingAnswers {
  goal: Goal;
  experience: Experience;
  minutes: Minutes;
  floorOk: boolean;
}

export type Shape = 'short' | 'balanced' | 'full';

export interface PlanCandidate {
  /** Stable across regenerations for the same answers — used as a React key. */
  shape: Shape;
  name: string;
  description: string;
  /** Why this plan looks the way it does, in the user's own terms. */
  rationale: string;
  steps: ResolvedStep[];
  durationSeconds: number;
}

export const GOAL_LABELS: Record<Goal, string> = {
  balance: 'Balance and focus',
  strength: 'Strength and stamina',
  calm: 'Calm and mobility',
};

export const EXPERIENCE_LABELS: Record<Experience, string> = {
  new: 'New to yoga',
  some: 'Done a bit',
  regular: 'Practise regularly',
};

export const MINUTES_OPTIONS: Minutes[] = [5, 10, 20];
