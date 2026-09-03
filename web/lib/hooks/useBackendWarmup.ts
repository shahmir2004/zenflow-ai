'use client';

import { useEffect, useRef, useState } from 'react';
import { config } from '@/lib/config';

export type WarmupState = 'cold' | 'warming' | 'warm' | 'unreachable';

let sharedState: WarmupState = 'cold';
let inFlight: Promise<void> | null = null;

/**
 * Wakes the backend before the user needs it.
 *
 * The backend is on Render's free tier: after ~15 minutes idle the first
 * request takes 30-60s while the dyno boots. Firing this on the *landing*
 * page — not the session page — means the boot happens while someone reads
 * the hero, and "Begin a session" lands on a warm server. That is the whole
 * difference between the demo feeling broken and feeling instant.
 *
 * Module-level state dedupes across components and survives navigation, so the
 * landing and session pages share one ping.
 */
export function useBackendWarmup(enabled = true): WarmupState {
  const [state, setState] = useState<WarmupState>(sharedState);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    if (sharedState === 'warm') {
      setState('warm');
      return;
    }

    if (!inFlight) {
      sharedState = 'warming';
      inFlight = (async () => {
        try {
          // No timeout: a cold start legitimately takes up to a minute, and
          // aborting early would just make us retry into the same boot.
          const res = await fetch(`${config.api.baseUrl}${config.api.endpoints.yogaHealth}`, {
            cache: 'no-store',
          });
          sharedState = res.ok ? 'warm' : 'unreachable';
        } catch {
          sharedState = 'unreachable';
        } finally {
          inFlight = null;
        }
      })();
    }

    setState('warming');
    void inFlight?.then(() => {
      if (mountedRef.current) setState(sharedState);
    });
  }, [enabled]);

  return state;
}
