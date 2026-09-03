'use client';

/**
 * MediaPipe Pose Landmarker.
 *
 * Lazily creates a singleton landmarker in VIDEO mode. Settings match what the
 * backend's yoga thresholds were tuned against (docs/YOGA_API.md §6) — changing
 * the model or the confidence floors here will silently shift detection
 * behaviour on the server side.
 *
 * Assets are served from public/ (vendored by scripts/copy-mediapipe-assets.mjs)
 * so the demo has no third-party CDN on its critical path. If those are absent
 * — a tree where the postinstall download failed — it falls back to the
 * canonical remote URLs rather than failing to start.
 */

import { config } from '@/lib/config';
import type { PoseLandmark } from '@/lib/contracts/yoga';

export interface PoseLandmarkerLike {
  detectForVideo: (video: HTMLVideoElement, timestampMs: number) => unknown;
  close?: () => void;
}

let landmarkerPromise: Promise<PoseLandmarkerLike> | null = null;

interface RawLandmark {
  x?: number;
  y?: number;
  z?: number;
  visibility?: number;
}

interface DetectionResult {
  landmarks?: RawLandmark[][];
}

async function headOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

async function create(): Promise<PoseLandmarkerLike> {
  const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');

  // Prefer the vendored copies; fall back to the CDN if they are not there.
  const wasmPath = (await headOk(`${config.pose.wasmPath}/vision_wasm_internal.js`))
    ? config.pose.wasmPath
    : config.pose.remoteWasmUrl;

  const modelPath = (await headOk(config.pose.modelPath))
    ? config.pose.modelPath
    : config.pose.remoteModelUrl;

  if (wasmPath !== config.pose.wasmPath || modelPath !== config.pose.modelPath) {
    console.warn(
      '[MediaPipe] Vendored assets missing — loading from CDN. ' +
        'Run `npm run assets` to self-host them.'
    );
  }

  const vision = await FilesetResolver.forVisionTasks(wasmPath);

  const build = (delegate: 'GPU' | 'CPU') =>
    PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: modelPath, delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.5,
      minPosePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

  try {
    return (await build('GPU')) as unknown as PoseLandmarkerLike;
  } catch (error) {
    // WebGL is unavailable on some mobile browsers and in most headless
    // environments. CPU is slower but yoga only needs 12fps.
    console.warn('[MediaPipe] GPU delegate failed, falling back to CPU.', error);
    return (await build('CPU')) as unknown as PoseLandmarkerLike;
  }
}

export function getPoseLandmarker(): Promise<PoseLandmarkerLike> {
  if (!landmarkerPromise) {
    landmarkerPromise = create().catch((error) => {
      // Don't cache a rejected promise — a retry should be able to succeed.
      landmarkerPromise = null;
      throw error;
    });
  }
  return landmarkerPromise;
}

export function resetPoseLandmarker(): void {
  landmarkerPromise = null;
}

/**
 * Pull the first (and only) person's landmarks out of a detection result.
 * Returns 33 landmarks, or an empty array when no body is in frame.
 */
export function extractLandmarks(result: unknown): PoseLandmark[] {
  const landmarks = (result as DetectionResult | null)?.landmarks;
  if (!landmarks || landmarks.length === 0) return [];

  return landmarks[0].map((lm) => ({
    x: Number.isFinite(lm.x) ? (lm.x as number) : 0,
    y: Number.isFinite(lm.y) ? (lm.y as number) : 0,
    z: Number.isFinite(lm.z) ? (lm.z as number) : 0,
    visibility: Number.isFinite(lm.visibility) ? (lm.visibility as number) : 1,
  }));
}
