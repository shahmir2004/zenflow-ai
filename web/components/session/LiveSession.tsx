'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import { config } from '@/lib/config';
import {
  LOW_CONFIDENCE_THRESHOLD,
  isFramingProblem,
  type PoseLandmark,
  type YogaResponse,
} from '@/lib/contracts/yoga';
import { getYogaPose, YOGA_POSES } from '@/lib/data/poses';
import { defaultFlow, getYogaFlow, type YogaFlow } from '@/lib/data/flows';
import { useCamera } from '@/lib/hooks/useCamera';
import { usePoseDetection } from '@/lib/hooks/usePoseDetection';
import { useYogaWebSocket } from '@/lib/hooks/useYogaWebSocket';
import { useSpeech } from '@/lib/hooks/useSpeech';
import { useChime } from '@/lib/hooks/useChime';
import { useBackendWarmup } from '@/lib/hooks/useBackendWarmup';
import { usePersisted, STORAGE_KEYS } from '@/lib/hooks/usePersisted';
import { useSessionSave } from '@/lib/hooks/useSessionSave';
import { useHomeHref, useSignedIn } from '@/lib/hooks/useSignedIn';
import { usePreviewDriver } from '@/lib/hooks/usePreviewDriver';
import {
  useYogaFlow,
  type SessionSummary as Summary,
  type YogaSessionConfig,
} from '@/lib/hooks/useYogaFlow';

import { SkeletonOverlay } from './SkeletonOverlay';
import { HoldRing } from './HoldRing';
import { PoseBadge } from './PoseBadge';
import { CueLine, type CueKind } from './CueLine';
import { BreathPacer } from './BreathPacer';
import { ControlBar, type SessionMode } from './ControlBar';
import { PoseSheet } from './PoseSheet';
import { SessionSummary } from './SessionSummary';
import { SessionGate } from './states/SessionGate';
import { FramingHint } from './states/FramingHint';
import { ConnectionChip } from './states/ConnectionChip';
import styles from './LiveSession.module.css';

interface LiveSessionProps {
  initialPoseId?: string;
  initialFlowId?: string;
  initialMode: SessionMode;
  openSheetOnLoad?: boolean;
  /**
   * A plan built for this user, which takes precedence over the built-in
   * flows. Same shape, so nothing downstream needs to know the difference.
   */
  customFlow?: YogaFlow;
  /** Links the saved session back to the plan it followed. */
  planId?: string | null;
  /**
   * Scripted stand-in for the camera and the coach (`?preview=1`). Used to
   * inspect the live states without a person in front of a lens. It labels
   * itself on screen — nothing ever falls back to it silently.
   */
  preview?: boolean;
}

/** Seconds of "everything visible" before the flow starts. */
const FRAMING_COUNTDOWN = 3;

export function LiveSession({
  initialPoseId,
  initialFlowId,
  initialMode,
  openSheetOnLoad = false,
  customFlow,
  planId = null,
  preview = false,
}: LiveSessionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const homeHref = useHomeHref();
  const signedIn = useSignedIn();

  const [mode, setMode] = useState<SessionMode>(initialMode);
  const [singlePoseId, setSinglePoseId] = usePersistedPose(initialPoseId);
  const [sheetOpen, setSheetOpen] = useState(openSheetOnLoad);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pausedState, setPausedState] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [landmarks, setLandmarks] = useState<PoseLandmark[]>([]);
  // Read from the stream itself rather than assumed: the overlay has to
  // reproduce the video's object-fit: cover crop to stay on the body.
  const [cameraAspect, setCameraAspect] = useState(16 / 9);

  const [voiceOn, setVoiceOn] = usePersisted<boolean>(STORAGE_KEYS.voice, true);
  const [focusSurface, setFocusSurface] = usePersisted<boolean>(
    STORAGE_KEYS.focusSurface,
    false
  );

  const flowDefinition = useMemo(
    () => customFlow ?? getYogaFlow(initialFlowId) ?? defaultFlow(),
    [customFlow, initialFlowId]
  );

  const sessionConfig: YogaSessionConfig = useMemo(
    () =>
      mode === 'flow'
        ? { mode: 'flow', flow: flowDefinition }
        : { mode: 'single', poseId: singlePoseId },
    [mode, flowDefinition, singlePoseId]
  );

  const warmup = useBackendWarmup(!preview);
  const camera = useCamera(videoRef);
  const { speak, cancel: cancelSpeech, setMuted, supported: voiceSupported } = useSpeech();
  const { chime, unlock: unlockAudio } = useChime();

  // The speech hook owns muting so a toggle silences mid-utterance.
  useEffect(() => {
    setMuted(!voiceOn);
  }, [voiceOn, setMuted]);

  const {
    connection,
    lastResponse: socketResponse,
    sendLandmarks,
    setPose,
    retry,
  } = useYogaWebSocket({
    enabled: !preview && camera.isReady,
    initialPose: singlePoseId,
  });

  const handleLandmarks = useCallback(
    (detected: PoseLandmark[], timestamp: number) => {
      setLandmarks(detected);
      sendLandmarks(detected, timestamp);
    },
    [sendLandmarks]
  );

  const handleNoBody = useCallback(() => setLandmarks([]), []);

  /*
   * Pausing stops the detection loop and the socket frames, not the camera.
   * Tearing the camera down would make resuming take a permission round trip
   * and a second of black; leaving it running makes resume instant, and no
   * frame is sent or evaluated in the meantime.
   */
  const pausedRef = useRef(false);

  const detection = usePoseDetection({
    videoRef,
    enabled: !preview && camera.isReady && !pausedState,
    onLandmarks: handleLandmarks,
    onNoBody: handleNoBody,
  });

  // In preview the script supplies both halves of the pipeline; everything
  // downstream reads these, so the UI cannot tell the difference.
  const previewFrame = usePreviewDriver(preview, singlePoseId, pausedState);
  const lastResponse = previewFrame?.response ?? socketResponse;
  const shownLandmarks = previewFrame?.landmarks ?? landmarks;

  /*
   * Destructured deliberately. The hook returns a fresh object each render, so
   * depending on `save` as a whole gave handleComplete a new identity every
   * render — which flowed into useYogaFlow's finishStep, into the response
   * effect's dependencies, and produced a setState-render-setState loop that
   * pinned the session on its first frame. persist and reset are useCallback
   * with no dependencies, so these three are stable.
   */
  const {
    state: saveState,
    persist: persistSession,
    reset: resetSave,
  } = useSessionSave();

  /*
   * Read the current frame without re-rendering on every one. The flow hook
   * calls this only when a new correction takes over — a few times a session,
   * not at 12fps — so a ref is both enough and much cheaper than threading
   * landmarks through state.
   */
  const landmarksRef = useRef<PoseLandmark[]>([]);
  // shownLandmarks, not landmarks: this must be the same frame the overlay is
  // drawing, or a snapshot would show something the user never saw. It also
  // means the preview drives snapshots like everything else.
  landmarksRef.current = shownLandmarks;
  const getLandmarks = useCallback(() => landmarksRef.current, []);

  const handleComplete = useCallback(
    (result: Summary) => {
      setSummary(result);
      persistSession(result, planId ? 'plan' : mode, planId);
      // The sheet is reference material for a pose you are about to hold; once
      // the session is over it is just something layered under the summary.
      setSheetOpen(false);
    },
    [persistSession, mode, planId]
  );

  const flow = useYogaFlow({
    config: sessionConfig,
    response: lastResponse,
    setPose,
    speak,
    onComplete: handleComplete,
    getLandmarks,
  });

  /* ── the chime, fired once per hold ─────────────────────────────────── */
  // `just_completed` is true on exactly one frame, which is precisely the
  // event we want — but a dropped frame would lose it, so `hold_complete`
  // latching is the backstop for a render that joins late.
  const chimedRef = useRef(false);
  useEffect(() => {
    if (!lastResponse) return;
    if (lastResponse.just_completed && !chimedRef.current) {
      chimedRef.current = true;
      chime();
    }
    if (!lastResponse.hold_complete) chimedRef.current = false;
  }, [lastResponse, chime]);

  /* ── pre-session framing countdown ──────────────────────────────────── */
  // Waits until the coach reports a clean read, then counts down on the hold
  // ring so the ring's meaning is learned before it matters.
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current || flow.active || summary) return;
    if (!lastResponse) return;
    if (isFramingProblem(lastResponse)) return;
    if (lastResponse.confidence < LOW_CONFIDENCE_THRESHOLD) return;
    if (countdown !== null) return;
    setCountdown(FRAMING_COUNTDOWN);
  }, [lastResponse, flow.active, summary, countdown]);

  // Depends on flow.start, not on `flow`: the controller object is rebuilt on
  // every render, so depending on it cleared and re-armed this timeout ~12
  // times a second and the countdown never actually advanced.
  const startFlow = flow.start;
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      startedRef.current = true;
      startFlow();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown, startFlow]);

  /* ── derived view state ─────────────────────────────────────────────── */

  const currentPose =
    flow.currentPose ?? getYogaPose(singlePoseId) ?? YOGA_POSES[0];

  const framingProblem = isFramingProblem(lastResponse);
  const lowConfidence =
    !framingProblem &&
    lastResponse !== null &&
    lastResponse.current_pose !== null &&
    lastResponse.confidence > 0 &&
    lastResponse.confidence < LOW_CONFIDENCE_THRESHOLD;

  const { cueKind, cueMessage } = deriveCue({
    response: lastResponse,
    framingProblem,
    resting: flow.phase === 'rest',
    paused: flow.paused,
    pausedPoseName: flow.currentPose?.name ?? null,
    restRemaining: flow.restRemaining,
    nextPoseName: flow.nextPose?.name ?? null,
    countdown,
  });

  const holdComplete = lastResponse?.hold_complete ?? false;
  // The pacer belongs to a settled pose. Pacing a breath while also correcting
  // someone asks for two things at once.
  const showBreathPacer =
    flow.active && flow.isInPose && !framingProblem && cueKind !== 'correcting';

  const handleSelectPose = useCallback(
    (poseId: string) => {
      setSinglePoseId(poseId);
      if (mode === 'flow') setMode('single');
      flow.selectPose(poseId);
      setSheetOpen(false);
    },
    [flow, mode, setSinglePoseId]
  );

  const handleModeChange = useCallback(
    (next: SessionMode) => {
      if (next === mode) return;
      setMode(next);
      startedRef.current = false;
      setCountdown(null);
      flow.stop();
    },
    [mode, flow]
  );

  const handlePauseChange = useCallback(
    (next: boolean) => {
      pausedRef.current = next;
      setPausedState(next);
      if (next) {
        cancelSpeech();
        flow.pause();
      } else {
        flow.resume();
      }
    },
    [flow, cancelSpeech]
  );

  const handleEndSession = useCallback(() => {
    cancelSpeech();
    const result = flow.buildSummary();
    setSummary(result);
    persistSession(result, planId ? 'plan' : mode, planId);
    flow.stop();
  }, [flow, cancelSpeech, persistSession, mode, planId]);

  const handleFlowAgain = useCallback(() => {
    setSummary(null);
    resetSave();
    startedRef.current = false;
    setCountdown(null);
    flow.start();
  }, [flow, resetSave]);

  const handleStartCamera = useCallback(() => {
    // Unlock audio inside the click so the chime can play later without one.
    unlockAudio();
    void camera.start();
  }, [camera, unlockAudio]);

  const gateVisible = !preview && !camera.isReady;

  return (
    <div
      className={styles.session}
      data-surface={focusSurface ? 'dark' : 'light'}
    >
      <video
        ref={videoRef}
        className={styles.video}
        data-preview={preview}
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          if (el.videoWidth && el.videoHeight) {
            setCameraAspect(el.videoWidth / el.videoHeight);
          }
        }}
        playsInline
        muted
        // Mirrored so the user sees themselves as in a mirror. The landmarks
        // sent to the backend are never flipped.
        aria-hidden="true"
      />
      <div className={styles.vignette} aria-hidden="true" />

      {!gateVisible && (
        <>
          <SkeletonOverlay
            landmarks={shownLandmarks}
            jointColors={lastResponse?.joint_colors ?? {}}
            mirrored={!preview}
            // Over a real camera the overlay must crop exactly as the video
            // does. In preview there is no video to match, so the figure is
            // letterboxed instead and stays whole on a phone.
            aspectRatio={preview ? 3 / 4 : cameraAspect}
            fit={preview ? 'contain' : 'cover'}
          />

          {preview && (
            <span className={styles.previewChip}>
              Preview · simulated coach, no camera
            </span>
          )}

          <FramingHint
            active={framingProblem}
            lowConfidence={lowConfidence}
            confidence={lastResponse?.confidence ?? 0}
          />

          <Link href={homeHref} className={styles.back}>
            <ArrowLeft size={16} strokeWidth={2.75} />
            {signedIn ? 'Your practice' : 'Back to the poses'}
          </Link>

          <div className={styles.topLeft}>
            <PoseBadge
              pose={currentPose}
              step={
                mode === 'flow'
                  ? { index: Math.min(flow.stepIndex + 1, flow.totalSteps), total: flow.totalSteps }
                  : undefined
              }
            />
            <ConnectionChip connection={connection} onRetry={retry} />
          </div>

          <div className={styles.topRight}>
            <HoldRing
              progress={flow.progress}
              seconds={flow.holdSeconds}
              targetSeconds={flow.desiredHoldSeconds}
              complete={holdComplete}
              countdown={countdown ?? undefined}
            />
            <AnimatePresence>
              {showBreathPacer && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <BreathPacer />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <CueLine
            kind={cueKind}
            message={cueMessage}
            progressPercent={flow.progress * 100}
            voiceOn={voiceOn}
          />

          <ControlBar
            mode={mode}
            onModeChange={handleModeChange}
            currentPose={currentPose}
            onSelectPose={handleSelectPose}
            steps={flow.steps}
            stepIndex={flow.stepIndex}
            nextPose={flow.nextPose}
            voiceOn={voiceOn}
            onVoiceChange={setVoiceOn}
            voiceSupported={voiceSupported}
            focusSurface={focusSurface}
            onFocusSurfaceChange={setFocusSurface}
            onOpenDetails={() => setSheetOpen(true)}
            onEndSession={handleEndSession}
          paused={flow.paused}
          onPauseChange={handlePauseChange}
          sessionActive={flow.active}
          />
        </>
      )}

      <PoseSheet
        pose={currentPose}
        open={sheetOpen}
        showPicker={mode === 'single'}
        onSelectPose={(poseId) => {
          handleSelectPose(poseId);
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
        onHoldThisPose={() => {
          handleSelectPose(currentPose.id);
          setSheetOpen(false);
        }}
      />

      {summary && (
        <SessionSummary
          summary={summary}
          onFlowAgain={handleFlowAgain}
          saveState={saveState}
        />
      )}

      {gateVisible && (
        <SessionGate
          cameraStatus={camera.status}
          cameraError={camera.error}
          modelError={detection.error}
          warmup={warmup}
          poseId={currentPose.id}
          onStart={handleStartCamera}
        />
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────
   Helpers
   ──────────────────────────────────────────────────────────────────── */

/** The selected pose survives a reload, seeded by the URL when one is given. */
function usePersistedPose(initial?: string) {
  const [stored, setStored] = usePersisted<string>(
    STORAGE_KEYS.lastPose,
    initial ?? YOGA_POSES[0].id
  );
  // A pose named in the URL is an explicit choice and outranks the stored one.
  const [value, setValue] = useState(initial ?? stored);
  useEffect(() => {
    if (!initial) setValue(stored);
  }, [initial, stored]);

  const update = useCallback(
    (poseId: string) => {
      setValue(poseId);
      setStored(poseId);
    },
    [setStored]
  );

  return [value, update] as const;
}

/**
 * Turns a backend response into the one line to show.
 *
 * Precedence matters more than it looks: a framing problem outranks every form
 * correction, because a correction computed from joints the camera cannot see
 * is not just unhelpful, it is wrong.
 */
function deriveCue(args: {
  response: YogaResponse | null;
  framingProblem: boolean;
  resting: boolean;
  restRemaining: number;
  nextPoseName: string | null;
  countdown: number | null;
  paused: boolean;
  pausedPoseName: string | null;
}): { cueKind: CueKind; cueMessage: string } {
  const {
    response, framingProblem, resting, restRemaining, nextPoseName, countdown,
    paused, pausedPoseName,
  } = args;

  /*
   * Pause outranks everything, and says what it costs.
   *
   * The server's hold timer is wall-clock and drops a hold once the body has
   * been absent past its debounce, so a paused hold is genuinely gone rather
   * than suspended. Saying so here is the difference between a user choosing
   * to pause and a user discovering their twenty seconds vanished.
   */
  if (paused) {
    return {
      cueKind: 'waiting',
      cueMessage: pausedPoseName
        ? `Paused. ${pausedPoseName} starts again from zero when you resume.`
        : 'Paused.',
    };
  }

  if (countdown !== null) {
    return { cueKind: 'waiting', cueMessage: 'Hold still — starting in a moment.' };
  }

  if (resting) {
    return {
      cueKind: 'waiting',
      cueMessage: nextPoseName
        ? `Rest ${restRemaining}. Next up, ${nextPoseName}.`
        : `Rest ${restRemaining}.`,
    };
  }

  if (framingProblem) {
    return {
      cueKind: 'framing',
      cueMessage: 'Step back so your whole body is in the frame.',
    };
  }

  if (!response) {
    return { cueKind: 'waiting', cueMessage: 'Finding you in the frame.' };
  }

  if (response.hold_complete) {
    return { cueKind: 'complete', cueMessage: 'Great hold — pose complete.' };
  }

  // One at a time, always the leading correction.
  const correction = response.corrections[0];
  if (!response.is_in_pose && correction) {
    return { cueKind: 'correcting', cueMessage: correction };
  }

  if (response.is_in_pose) {
    return { cueKind: 'holding', cueMessage: 'Hold steady — breathe.' };
  }

  return { cueKind: 'waiting', cueMessage: 'Move into the pose.' };
}
