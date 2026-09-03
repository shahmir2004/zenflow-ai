'use client';

import { useBackendWarmup } from '@/lib/hooks/useBackendWarmup';
import { useCatalogParity } from '@/lib/hooks/useCatalogParity';

/**
 * Renders nothing. Its whole job is to start waking the backend the moment
 * the landing page mounts.
 *
 * The backend sleeps after ~15 minutes idle and takes 30-60s to boot. Firing
 * the health ping here — rather than when the session starts — spends that
 * boot on time the user was going to spend reading anyway, so "Begin a
 * session" connects to a server that is already up.
 */
export function WarmBackend() {
  useBackendWarmup();
  useCatalogParity();
  return null;
}
