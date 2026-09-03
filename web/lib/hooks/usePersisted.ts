'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * State backed by localStorage, for the handful of preferences worth carrying
 * across a reload: voice on/off, the focus surface, the last pose held.
 *
 * Reads happen in an effect rather than in the initialiser so the first render
 * matches the server's, avoiding a hydration mismatch. That means one frame of
 * the default value — fine for a preference, and the alternative (suppressing
 * hydration warnings) hides real bugs.
 */
export function usePersisted<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // Private mode, disabled storage, or corrupt JSON. The default stands.
    }
    setHydrated(true);
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved =
          typeof next === 'function' ? (next as (p: T) => T)(prev) : next;
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved));
        } catch {
          // Storage full or unavailable — keep the in-memory value.
        }
        return resolved;
      });
    },
    [key]
  );

  return [value, update, hydrated] as const;
}

export const STORAGE_KEYS = {
  voice: 'zenflow.voice',
  focusSurface: 'zenflow.focus-surface',
  lastPose: 'zenflow.last-pose',
} as const;
