/**
 * Backend URL configuration.
 *
 * One environment variable drives everything. The WebSocket base is derived
 * from it rather than configured separately, so a production deploy can never
 * end up with an https page opening a ws:// socket (which browsers block).
 */

const RAW_BASE_URL =
  process.env.NEXT_PUBLIC_FORM_COACH_URL || 'http://localhost:8000';

function toWsUrl(url: string): string {
  return url
    .replace(/^https:\/\//, 'wss://')
    .replace(/^http:\/\//, 'ws://')
    .replace(/\/$/, '');
}

function toHttpUrl(url: string): string {
  return url
    .replace(/^wss:\/\//, 'https://')
    .replace(/^ws:\/\//, 'http://')
    .replace(/\/$/, '');
}

export const config = {
  api: {
    baseUrl: toHttpUrl(RAW_BASE_URL),
    wsUrl: toWsUrl(RAW_BASE_URL),
    endpoints: {
      /** Cold-start warm-up ping + yoga connection count. */
      yogaHealth: '/api/yoga/health',
      /** The pose catalog — the contract for valid `pose` labels. */
      yogaPoses: '/api/yoga/poses',
      /** Restarts the hold, keeping the selected pose. */
      resetYoga: '/api/reset/yoga',
      /**
       * NOTE: the design handoff README says `/ws/yoga/{id}`. That is wrong —
       * the yoga router is mounted under an `/api` prefix in backend/main.py,
       * so the real path carries it. docs/YOGA_API.md is the correct reference.
       */
      wsYoga: '/api/ws/yoga',
    },
  },

  pose: {
    /**
     * Self-hosted by scripts/copy-mediapipe-assets.mjs. lib/mediapipe.ts falls
     * back to the canonical Google Storage URL if this 404s, so a tree where
     * the postinstall download failed still runs.
     */
    modelPath:
      process.env.NEXT_PUBLIC_MEDIAPIPE_MODEL_PATH ||
      '/models/pose_landmarker_lite.task',
    wasmPath:
      process.env.NEXT_PUBLIC_MEDIAPIPE_WASM_PATH || '/mediapipe/wasm',
    remoteModelUrl:
      'https://storage.googleapis.com/mediapipe-models/pose_landmarker/' +
      'pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
    remoteWasmUrl:
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm',
  },

  session: {
    /**
     * Yoga is static — 30fps buys nothing and burns battery. The yoga route
     * has no server-side rate limiting (unlike the exercise route), so pacing
     * is entirely the client's responsibility. 12fps also keeps the backend's
     * default 10-frame hold debounce at a comfortable ~0.8s of grace.
     */
    targetFps: 12,
  },
} as const;

export const frameIntervalMs = 1000 / config.session.targetFps;
