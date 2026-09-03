'use client';

import { useEffect, useRef, useState } from 'react';
import type { PoseLandmark, YogaResponse } from '@/lib/contracts/yoga';
import { getYogaPose } from '@/lib/data/poses';
import { JOINT_KEYS, JOINT_META, flagsFor, skeletonFor } from '@/lib/data/skeletons';

export interface PreviewFrame {
  landmarks: PoseLandmark[];
  response: YogaResponse;
}

/**
 * A scripted stand-in for the camera and the backend.
 *
 * Reached at `/session?preview=1`. It exists because the live view cannot be
 * inspected any other way without a person, a room and good light — every
 * state that matters (framing failure, an active correction, a running hold,
 * completion) is transient and hard to reproduce on demand. The preview walks
 * through all of them on a fixed loop.
 *
 * It is deliberately not a fallback: nothing switches to it automatically, and
 * the session labels itself as a preview while it runs. A demo that silently
 * fakes its feedback would be worse than one that fails honestly.
 */
export function usePreviewDriver(enabled: boolean, poseId: string): PreviewFrame | null {
  const [frame, setFrame] = useState<PreviewFrame | null>(null);
  const startedAt = useRef<number>(0);
  const completedRef = useRef(false);

  // Restart the script whenever the pose changes, mirroring the backend's
  // behaviour of resetting the hold on a pose switch.
  useEffect(() => {
    startedAt.current = performance.now();
    completedRef.current = false;
  }, [poseId, enabled]);

  useEffect(() => {
    if (!enabled) return;

    const pose = getYogaPose(poseId);
    if (!pose) return;

    const target = pose.holdTargetSeconds;
    const skeleton = skeletonFor(poseId);
    const flags = flagsFor(poseId);

    const FRAMING_UNTIL = 2.5;
    const ADJUSTING_UNTIL = 6.5;

    const id = window.setInterval(() => {
      const elapsed = (performance.now() - startedAt.current) / 1000;

      // Loop a few seconds past completion so the finished state is visible.
      if (elapsed > ADJUSTING_UNTIL + target + 6) {
        startedAt.current = performance.now();
        completedRef.current = false;
        return;
      }

      // A little drift so the figure reads as a living body, not a diagram.
      const wobble = (seed: number) =>
        Math.sin(elapsed * 1.6 + seed) * 0.0035 + Math.sin(elapsed * 0.7 + seed * 2) * 0.002;

      const landmarks: PoseLandmark[] = Array.from({ length: 33 }, () => ({
        x: 0.5,
        y: 0.5,
        z: 0,
        visibility: 0,
      }));

      JOINT_KEYS.forEach((key, i) => {
        const [px, py] = skeleton[key];
        // The figure's percentage space occupies the middle of the frame.
        landmarks[JOINT_META[key].landmark] = {
          x: 0.5 + (px - 50) / 100 * 0.62 + wobble(i),
          y: py / 100 * 0.88 + 0.05 + wobble(i * 1.7),
          z: 0,
          visibility: 0.96,
        };
      });

      const framing = elapsed < FRAMING_UNTIL;
      const adjusting = !framing && elapsed < ADJUSTING_UNTIL;
      const holdSeconds = adjusting ? 0 : Math.max(0, elapsed - ADJUSTING_UNTIL);
      const holdComplete = holdSeconds >= target;
      const justCompleted = holdComplete && !completedRef.current;
      if (justCompleted) completedRef.current = true;

      const jointColors: Record<string, 'green' | 'yellow' | 'red'> = {};
      if (!framing) {
        for (const key of JOINT_KEYS) {
          const backend = JOINT_META[key].backend;
          if (!backend) continue;
          const flag = adjusting ? flags[key] : undefined;
          jointColors[backend] =
            flag === 'fix' ? 'red' : flag === 'adjust' ? 'yellow' : 'green';
        }
      }

      const corrections = adjusting ? [pose.cues[0]] : [];

      setFrame({
        landmarks,
        response: {
          state: framing ? 'adjusting' : adjusting ? 'adjusting' : 'holding',
          current_pose: pose.id,
          pose_display: pose.name,
          camera_view: pose.cameraView,
          is_in_pose: !framing && !adjusting,
          hold_seconds: Math.min(holdSeconds, target + 2),
          hold_target_seconds: target,
          hold_progress: Math.min(1, holdSeconds / target),
          hold_complete: holdComplete,
          just_completed: justCompleted,
          violations: framing
            ? ['Body not fully visible']
            : adjusting
              ? ['Preview: simulated form fault']
              : [],
          corrections: framing
            ? ['Step back so your whole body is in the camera frame']
            : corrections,
          correction_message: framing
            ? 'Step back so your whole body is in the camera frame'
            : holdComplete
              ? 'Great hold — pose complete!'
              : adjusting
                ? pose.cues[0]
                : 'Hold steady — breathe',
          joint_colors: jointColors,
          confidence: framing ? 0 : 0.94,
          timestamp: performance.now(),
        },
      });
    }, 1000 / 12);

    return () => window.clearInterval(id);
  }, [enabled, poseId]);

  return enabled ? frame : null;
}
