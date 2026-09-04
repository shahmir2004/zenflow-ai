'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { migrateGuestSessions } from '@/lib/sessions/actions';
import { clearGuestSessions, readGuestSessions } from '@/lib/sessions/guest';

/**
 * Claims practice done before signing in.
 *
 * The landing page promises no account is needed for a first flow, which only
 * holds up if that flow still counts once an account exists. Guest sessions
 * live in localStorage; this hands them over the first time the user lands on
 * a signed-in page, then clears them.
 *
 * Runs once and renders a short confirmation, because silently absorbing
 * someone's practice is worse than saying nothing — they need to know it was
 * kept.
 */
export function ClaimGuestSessions() {
  const router = useRouter();
  const [claimed, setClaimed] = useState<number | null>(null);

  useEffect(() => {
    const pending = readGuestSessions();
    if (pending.length === 0) return;

    let cancelled = false;

    void migrateGuestSessions(pending).then((result) => {
      if (cancelled) return;

      // Clear only what was actually taken. Leaving failures behind means the
      // next visit tries again rather than dropping them on the floor.
      if (result.failed === 0) clearGuestSessions();

      if (result.migrated > 0) {
        setClaimed(result.migrated);
        router.refresh();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!claimed) return null;

  return (
    <p role="status" className="zf-fade-up" style={{ marginBottom: 20 }}>
      <span className="tag tag-accent-2">
        {claimed === 1
          ? 'Added the session you practised before signing in.'
          : `Added ${claimed} sessions you practised before signing in.`}
      </span>
    </p>
  );
}
