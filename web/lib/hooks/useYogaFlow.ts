'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isFramingProblem, type PoseLandmark, type YogaResponse } from '@/lib/contracts/yoga';
import { getYogaPose, type YogaPose } from '@/lib/data/poses';
import { stepHoldSeconds, type YogaFlow } from '@/lib/data/flows';
import {
  advancePhase,
  buildSteps,
  holdProgress,
  tallyCorrection,
  topCorrections,
  type CorrectionCount,
  type FlowPhase,
  type ResolvedStep,
} from '@/lib/data/flowEngine';

export type YogaSessionConfig =
  | { mode: 'single'; poseId: string }
  | { mode: 'flow'; flow: YogaFlow };

export interface CompletedPose {
  poseId: string;
  displayName: string;
  heldSeconds: number;
  /** What the hold was measured against — a flow may shorten a pose's target. */
  targetSeconds: number;
  /** False when the user skipped before reaching the target. */
  reachedTarget: boolean;
}

/**
 * The landmarks from the frame a fault was at its worst, kept so the summary
 * can show the user what their body was actually doing.
 *
 * 33 coordinates, never an image — which is what lets the app record this at
 * all without breaking the promise on the landing page.
 */
export interface FormSnapshot {
  poseId: string;
  correction: string;
  landmarks: PoseLandmark[];
  jointColors: Record<string, string>;
}

export interface SessionSummary {
  poses: CompletedPose[];
  totalHeldSeconds: number;
  posesToTarget: number;
  totalPoses: number;
  best: CompletedPose | null;
  toFixNext: CorrectionCount[];
  startedAt: string;
  endedAt: string;
  /** One per distinct correction — the frame it was worst. */
  snapshots: FormSnapshot[];
}

interface UseYogaFlowOptions {
  config: YogaSessionConfig;
  response: YogaResponse | null;
  setPose: (poseId: string) => void;
  speak: (text: string, opts?: { priority?: 'normal' | 'high'; dedupeMs?: number }) => void;
  onComplete?: (summary: SessionSummary) => void;
  /**
   * Reads the current frame's landmarks. Called only when a *new* correction
   * takes over, so this runs a handful of times a session rather than at 12fps.
   */
  getLandmarks?: () => PoseLandmark[];
}

export interface YogaFlowController {
  active: boolean;
  paused: boolean;
  phase: FlowPhase;
  stepIndex: number;
  totalSteps: number;
  steps: ResolvedStep[];
  currentPose: YogaPose | null;
  nextPose: YogaPose | null;
  desiredHoldSeconds: number;
  holdSeconds: number;
  progress: number;
  isInPose: boolean;
  restRemaining: number;
  completed: CompletedPose[];
  start: () => void;
  stop: () => void;
  skip: () => void;
  pause: () => void;
  resume: () => void;
  /** Jump to a pose in single mode, or to a step in flow mode. */
  selectPose: (poseId: string) => void;
  buildSummary: () => SessionSummary;
}

/**
 * The guided-yoga orchestrator: ties backend responses to voice cues and step
 * sequencing.
 *
 *   enter step -> speak setup cues -> (pose reached) speak hold cue and time
 *   the hold -> (final 3s countdown) -> (hold done) speak transition cue ->
 *   rest countdown -> next step ... -> speak completion.
 *
 * Completion is driven by the *step's* desired hold rather than the backend's
 * `hold_complete`, because a flow may deliberately hold a pose for less than
 * its catalog target. The backend's target is advisory (docs/YOGA_API.md §4).
 */
export function useYogaFlow({
  config,
  response,
  setPose,
  speak,
  onComplete,
  getLandmarks,
}: UseYogaFlowOptions): YogaFlowController {
  const steps: ResolvedStep[] = useMemo(() => {
    if (config.mode === 'single') {
      const pose = getYogaPose(config.poseId);
      return buildSteps({
        mode: 'single',
        poseId: config.poseId,
        holdSeconds: pose?.holdTargetSeconds ?? 20,
      });
    }
    return buildSteps({
      mode: 'flow',
      steps: config.flow.steps.map((s) => ({
        poseId: s.poseId,
        holdSeconds: stepHoldSeconds(s),
        restSeconds: s.restSeconds,
      })),
    });
  }, [config]);

  const [active, setActive] = useState(false);
  const [phase, setPhase] = useState<FlowPhase>('idle');
  const [stepIndex, setStepIndex] = useState(0);
  const [holdSeconds, setHoldSeconds] = useState(0);
  const [isInPose, setIsInPose] = useState(false);
  const [restRemaining, setRestRemaining] = useState(0);
  const [completed, setCompleted] = useState<CompletedPose[]>([]);
  const [paused, setPaused] = useState(false);

  // Refs mirror state so the response-driven effect reads current values
  // without re-subscribing on every change (it runs at 12fps).
  const phaseRef = useRef<FlowPhase>('idle');
  const activeRef = useRef(false);
  const stepIndexRef = useRef(0);
  const holdCueSpokenRef = useRef(false);
  const lastCountdownRef = useRef<number | null>(null);
  const completedRef = useRef<CompletedPose[]>([]);
  const tallyRef = useRef(new Map<string, CorrectionCount>());
  const lastCorrectionRef = useRef<string>('');
  const startedAtRef = useRef<string>(new Date().toISOString());
  // Keyed the same way as the tally, so a snapshot and its count stay paired.
  const snapshotsRef = useRef(new Map<string, FormSnapshot>());

  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { activeRef.current = active; }, [active]);
  useEffect(() => { stepIndexRef.current = stepIndex; }, [stepIndex]);
  useEffect(() => { completedRef.current = completed; }, [completed]);

  const currentStep = steps[stepIndex] ?? null;
  const currentPose = currentStep ? getYogaPose(currentStep.poseId) ?? null : null;
  const nextPose =
    stepIndex + 1 < steps.length ? getYogaPose(steps[stepIndex + 1].poseId) ?? null : null;
  const desiredHoldSeconds = currentStep?.holdSeconds ?? 0;

  const buildSummary = useCallback((): SessionSummary => {
    const poses = completedRef.current;
    const totalHeldSeconds = poses.reduce((a, p) => a + p.heldSeconds, 0);
    const best = poses.reduce<CompletedPose | null>(
      (bestSoFar, p) => (!bestSoFar || p.heldSeconds > bestSoFar.heldSeconds ? p : bestSoFar),
      null
    );
    return {
      poses,
      totalHeldSeconds,
      posesToTarget: poses.filter((p) => p.reachedTarget).length,
      totalPoses: steps.length,
      best,
      toFixNext: topCorrections(tallyRef.current, 3),
      startedAt: startedAtRef.current,
      endedAt: new Date().toISOString(),
      snapshots: [...snapshotsRef.current.values()],
    };
  }, [steps.length]);

  /** Enter a step: announce the setup cues and lock the backend's pose. */
  const enterStep = useCallback(
    (index: number) => {
      const step = steps[index];
      if (!step) return;
      const pose = getYogaPose(step.poseId);
      holdCueSpokenRef.current = false;
      lastCountdownRef.current = null;
      lastCorrectionRef.current = '';
      setHoldSeconds(0);
      setIsInPose(false);
      setPhase('setup');
      phaseRef.current = 'setup';
      setPose(step.poseId);

      if (pose) {
        const intro =
          (index === 0 ? '' : 'Next pose. ') + `${pose.name}. ` + pose.setupSteps.join(' ');
        speak(intro, { priority: 'high' });
      }
    },
    [steps, setPose, speak]
  );

  const start = useCallback(() => {
    setActive(true);
    setPaused(false);
    setCompleted([]);
    completedRef.current = [];
    tallyRef.current = new Map();
    snapshotsRef.current = new Map();
    startedAtRef.current = new Date().toISOString();
    setStepIndex(0);
    stepIndexRef.current = 0;
    enterStep(0);
  }, [enterStep]);

  const stop = useCallback(() => {
    setActive(false);
    setPaused(false);
    setPhase('idle');
    phaseRef.current = 'idle';
  }, []);

  const finishStep = useCallback(
    (heldSeconds: number, reachedTarget: boolean) => {
      const step = steps[stepIndexRef.current];
      const pose = step ? getYogaPose(step.poseId) : null;

      if (pose) {
        const entry: CompletedPose = {
          poseId: pose.id,
          displayName: pose.name,
          heldSeconds: Math.round(heldSeconds),
          targetSeconds: step?.holdSeconds ?? pose.holdTargetSeconds,
          reachedTarget,
        };
        const updated = [...completedRef.current, entry];
        completedRef.current = updated;
        setCompleted(updated);
        speak(pose.transitionCue, { priority: 'high' });
      }

      const hasNext = stepIndexRef.current + 1 < steps.length;
      const next = advancePhase('holding', 'HOLD_DONE', hasNext);
      setPhase(next);
      phaseRef.current = next;

      if (next === 'rest') {
        setRestRemaining(step?.restSeconds ?? 0);
      } else if (next === 'complete') {
        setActive(false);
        speak('Session complete. Wonderful work.', { priority: 'high' });
        onComplete?.(buildSummary());
      }
    },
    [steps, speak, onComplete, buildSummary]
  );

  const pause = useCallback(() => {
    if (!activeRef.current) return;
    setPaused(true);
  }, []);

  /**
   * Resuming restarts the current pose rather than continuing it.
   *
   * This is honest rather than convenient: HoldTimer is wall-clock on the
   * server and drops a hold once the body has been absent for
   * YOGA_HOLD_DEBOUNCE_FRAMES, so the hold is genuinely gone by the time
   * anyone unpauses. Pretending otherwise would show a number the coach does
   * not agree with. Pausing between poses costs nothing, which is the common
   * case.
   */
  const resume = useCallback(() => {
    setPaused(false);
    if (phaseRef.current === 'holding' || phaseRef.current === 'setup') {
      enterStep(stepIndexRef.current);
    }
  }, [enterStep]);

  const skip = useCallback(() => {
    if (!active) return;
    finishStep(holdSeconds, false);
  }, [active, finishStep, holdSeconds]);

  /** Manual pose selection from the control bar's chip row. */
  const selectPose = useCallback(
    (poseId: string) => {
      const index = steps.findIndex((s) => s.poseId === poseId);
      if (index >= 0) {
        setStepIndex(index);
        stepIndexRef.current = index;
        enterStep(index);
        return;
      }
      // Single mode with a pose outside the step list: retarget step 0.
      setPose(poseId);
      holdCueSpokenRef.current = false;
      lastCorrectionRef.current = '';
      setHoldSeconds(0);
      setPhase('setup');
      phaseRef.current = 'setup';
    },
    [steps, enterStep, setPose]
  );

  // Drive setup -> holding -> done off each backend response.
  useEffect(() => {
    if (!active || !response || paused) return;
    const phaseNow = phaseRef.current;
    setIsInPose(response.is_in_pose);
    setHoldSeconds(response.hold_seconds);

    // Tally the leading correction once per episode, not once per frame — at
    // 12fps a 20s struggle would otherwise count as 240 occurrences.
    /*
     * "Step back so your whole body is in the camera frame" is not a form
     * fault — it means the camera cannot see enough of the body to judge one.
     * Tallying it would put a framing problem in "to fix next" and, worse,
     * carry it into the long-term form trend as though the user's Tree Pose
     * were getting worse when they simply stood too close.
     */
    const leading = isFramingProblem(response) ? '' : response.corrections[0] ?? '';
    if (leading && leading !== lastCorrectionRef.current && currentPose) {
      tallyCorrection(tallyRef.current, leading, currentPose.id, currentPose.name);

      // Keep the frame this fault first appeared on. Only the first is stored
      // per correction: later ones are the user already correcting, which is
      // not the thing worth showing them.
      const key = `${currentPose.id}::${leading}`;
      if (!snapshotsRef.current.has(key)) {
        const frame = getLandmarks?.();
        if (frame?.length === 33) {
          snapshotsRef.current.set(key, {
            poseId: currentPose.id,
            correction: leading,
            landmarks: frame,
            jointColors: response.joint_colors,
          });
        }
      }
    }
    lastCorrectionRef.current = leading;

    if (phaseNow === 'setup') {
      if (response.is_in_pose) {
        if (currentPose && !holdCueSpokenRef.current) {
          speak(currentPose.holdCue, { priority: 'high' });
          holdCueSpokenRef.current = true;
        }
        setPhase('holding');
        phaseRef.current = 'holding';
      } else if (response.correction_message) {
        // Coach them into position. De-duped inside useSpeech.
        speak(response.correction_message);
      }
      return;
    }

    if (phaseNow === 'holding') {
      if (!response.is_in_pose && response.hold_seconds < 0.2) {
        // The hold collapsed past the backend's debounce — guide them back.
        setPhase('setup');
        phaseRef.current = 'setup';
        holdCueSpokenRef.current = false;
        if (response.correction_message) speak(response.correction_message);
        return;
      }

      const remaining = desiredHoldSeconds - response.hold_seconds;
      if (response.is_in_pose && remaining <= 3 && remaining > 0) {
        const count = Math.ceil(remaining);
        if (lastCountdownRef.current !== count) {
          lastCountdownRef.current = count;
          speak(String(count), { priority: 'high', dedupeMs: 0 });
        }
      }

      if (response.hold_seconds >= desiredHoldSeconds && desiredHoldSeconds > 0) {
        finishStep(response.hold_seconds, true);
      }
    }
  }, [response, active, paused, currentPose, desiredHoldSeconds, speak, finishStep, getLandmarks]);

  // Rest countdown between flow steps.
  useEffect(() => {
    if (phase !== 'rest' || paused) return;
    if (restRemaining <= 0) {
      const nextIndex = stepIndexRef.current + 1;
      setStepIndex(nextIndex);
      stepIndexRef.current = nextIndex;
      enterStep(nextIndex);
      return;
    }
    const t = setTimeout(() => setRestRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [phase, restRemaining, paused, enterStep]);

  return {
    active,
    paused,
    phase,
    stepIndex,
    totalSteps: steps.length,
    steps,
    currentPose,
    nextPose,
    desiredHoldSeconds,
    holdSeconds,
    progress: holdProgress(holdSeconds, desiredHoldSeconds),
    isInPose,
    restRemaining,
    completed,
    start,
    stop,
    skip,
    pause,
    resume,
    selectPose,
    buildSummary,
  };
}
