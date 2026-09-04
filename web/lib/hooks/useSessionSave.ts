'use client';

import { useCallback, useRef, useState } from 'react';
import type { SessionSummary } from '@/lib/hooks/useYogaFlow';
import { saveSession } from '@/lib/sessions/actions';
import { appendGuestSession } from '@/lib/sessions/guest';
import { toSessionRecord, type SessionMode } from '@/lib/sessions/types';

export type SaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved' }
  | { status: 'guest' }
  | { status: 'error' };

/**
 * Persists a finished session, to the account if there is one and to
 * localStorage if there is not.
 *
 * Deliberately fire-and-report: the caller shows the summary immediately and
 * this resolves underneath it. The user has just finished holding a pose for
 * twenty-five seconds — they should not wait on a network round trip to be
 * told how it went.
 */
export function useSessionSave() {
  const [state, setState] = useState<SaveState>({ status: 'idle' });
  // Both "end session" and natural flow completion can fire for one session.
  const savedRef = useRef<string | null>(null);

  const persist = useCallback(
    (summary: SessionSummary, mode: SessionMode, planId: string | null = null) => {
      // Guard against double-saving the same session.
      const fingerprint = `${summary.startedAt}:${summary.poses.length}`;
      if (savedRef.current === fingerprint) return;
      savedRef.current = fingerprint;

      const record = toSessionRecord(summary, mode, planId);
      if (record.poses.length === 0 || record.totalHeldSeconds <= 0) {
        setState({ status: 'idle' });
        return;
      }

      setState({ status: 'saving' });

      void saveSession(record)
        .then((result) => {
          if (result.status === 'saved') {
            setState({ status: 'saved' });
          } else if (result.status === 'guest') {
            // No account yet. Hold it locally so it can be claimed later.
            appendGuestSession(record);
            setState({ status: 'guest' });
          } else if (result.status === 'error') {
            appendGuestSession(record);
            setState({ status: 'error' });
          } else {
            setState({ status: 'idle' });
          }
        })
        .catch(() => {
          // The action itself already swallows errors; this covers a genuine
          // network failure reaching it at all. Keep the record locally so it
          // is not simply lost.
          appendGuestSession(record);
          setState({ status: 'error' });
        });
    },
    []
  );

  const reset = useCallback(() => {
    savedRef.current = null;
    setState({ status: 'idle' });
  }, []);

  return { state, persist, reset };
}
