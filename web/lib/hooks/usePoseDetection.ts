'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { config, frameIntervalMs } from '@/lib/config';
import {
  extractLandmarks,
  getPoseLandmarker,
  resetPoseLandmarker,
  type PoseLandmarkerLike,
} from '@/lib/mediapipe';
import type { PoseLandmark } from '@/lib/contracts/yoga';

interface UsePoseDetectionOptions {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Run the loop only once the camera is up. */
  enabled: boolean;
  /** Called at the throttled rate with 33 landmarks. */
  onLandmarks: (landmarks: PoseLandmark[], timestamp: number) => void;
  /** Called when a frame contains no body at all. */
  onNoBody?: () => void;
}

/**
 * The rAF detection loop, throttled to config.session.targetFps.
 *
 * The throttle is load-bearing, not an optimisation: the yoga WebSocket route
 * has no server-side rate limiting, and the backend's hold debounce (10 frames
 * of grace) is expressed in frames, so streaming at 60fps would both flood the
 * socket and shrink the user's wobble tolerance from ~0.8s to ~0.16s.
 */
export function usePoseDetection({
  videoRef,
  enabled,
  onLandmarks,
  onNoBody,
}: UsePoseDetectionOptions) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const landmarkerRef = useRef<PoseLandmarkerLike | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastDetectRef = useRef(0);
  const lastTimestampRef = useRef(0);
  const runningRef = useRef(false);

  const callbacksRef = useRef({ onLandmarks, onNoBody });
  useEffect(() => {
    callbacksRef.current = { onLandmarks, onNoBody };
  }, [onLandmarks, onNoBody]);

  const init = useCallback(async () => {
    if (landmarkerRef.current) return;
    try {
      landmarkerRef.current = await getPoseLandmarker();
      setIsReady(true);
      setError(null);
    } catch (err) {
      console.error('[Pose] Landmarker init failed', err);
      resetPoseLandmarker();
      setError(
        'The pose model could not load. Check your connection and start the session again.'
      );
    }
  }, []);

  const loop = useCallback(() => {
    if (!runningRef.current) return;
    rafRef.current = requestAnimationFrame(loop);

    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker) return;
    if (video.readyState < 2 || video.paused || video.ended) return;

    const now = performance.now();
    if (now - lastDetectRef.current < frameIntervalMs) return;
    lastDetectRef.current = now;

    // detectForVideo requires strictly increasing timestamps. Two rAF ticks
    // can land in the same millisecond, which throws.
    const ts = Math.max(Math.floor(now), lastTimestampRef.current + 1);
    lastTimestampRef.current = ts;

    try {
      const landmarks = extractLandmarks(landmarker.detectForVideo(video, ts));
      if (landmarks.length === 33) {
        callbacksRef.current.onLandmarks(landmarks, ts);
      } else {
        callbacksRef.current.onNoBody?.();
      }
    } catch {
      // Transient detection failures happen when the video element is
      // resizing or the GPU context is momentarily lost. Skip the frame.
    }
  }, [videoRef]);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (enabled && isReady && !runningRef.current) {
      runningRef.current = true;
      rafRef.current = requestAnimationFrame(loop);
    }
    if (!enabled && runningRef.current) {
      runningRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, [enabled, isReady, loop]);

  useEffect(() => {
    return () => {
      runningRef.current = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, []);

  return { isReady, error, targetFps: config.session.targetFps };
}
