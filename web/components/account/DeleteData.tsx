'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteAllPracticeData } from '@/lib/sessions/actions';
import styles from './DeleteData.module.css';

/**
 * Erases everything the account has practised.
 *
 * The FAQ says "you can delete all of it at any time", so this is part of the
 * feature rather than an admin nicety. Two steps, because it cannot be undone —
 * and the confirmation says exactly what goes rather than asking "are you
 * sure?", which tells nobody anything.
 */
export function DeleteData({ sessionCount }: { sessionCount: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const remove = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteAllPracticeData();
      if (result.ok) {
        setDone(true);
        setConfirming(false);
        router.refresh();
      } else {
        setError(result.message ?? 'That did not go through. Try again.');
      }
    });
  };

  if (done) {
    return (
      <p className={styles.done} role="status">
        Deleted. Your sessions, plans and onboarding answers are gone. Your
        account is still here, and you can start again whenever you like.
      </p>
    );
  }

  return (
    <div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      {confirming ? (
        <div className={styles.confirm}>
          <p className={styles.confirmText}>
            This removes {sessionCount === 0 ? 'everything' : `all ${sessionCount} `}
            {sessionCount === 1 ? 'session' : sessionCount > 1 ? 'sessions' : ''}, your
            plan, your form history and your onboarding answers. It cannot be
            undone.
          </p>
          <div className={styles.confirmActions}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setConfirming(false)}
              disabled={pending}
            >
              Keep it
            </button>
            <button
              type="button"
              className={`btn ${styles.destructive}`}
              onClick={remove}
              disabled={pending}
            >
              {pending ? 'Deleting…' : 'Delete everything'}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setConfirming(true)}
        >
          Delete my practice data
        </button>
      )}
    </div>
  );
}
