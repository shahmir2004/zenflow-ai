import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // The MediaPipe WASM bundle and the .task model are served from public/ (see
  // scripts/copy-mediapipe-assets.mjs) rather than a CDN, so the demo has no
  // third-party runtime dependency on its critical path. They are immutable
  // once copied, so cache them hard.
  async headers() {
    return [
      {
        source: '/mediapipe/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      {
        source: '/models/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
    ];
  },
};

export default nextConfig;
