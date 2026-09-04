import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Vitest ran on defaults until now, which worked only because the first test
 * file used relative imports. Application code uses the `@/` alias throughout,
 * so without this any test importing a module that itself uses `@/` fails to
 * resolve — and the failure names the imported package, not the alias, which
 * sends you looking in the wrong place.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
  test: {
    // Pure logic only: pose scoring, streak arithmetic, catalog parity. The
    // browser-dependent parts (camera, MediaPipe, WebSocket) are verified by
    // running the app, not by mocking three APIs into a fake DOM.
    include: ['lib/**/*.test.ts'],
    environment: 'node',
  },
});
