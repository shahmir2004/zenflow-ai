'use client';

import { Loader, WifiOff } from 'lucide-react';
import type { ConnectionState } from '@/lib/hooks/useYogaWebSocket';
import styles from './ConnectionChip.module.css';

interface ConnectionChipProps {
  connection: ConnectionState;
  onRetry: () => void;
}

/**
 * The coach's connection, surfaced only when it is not fine.
 *
 * A dropped socket has a specific consequence worth stating: the backend holds
 * session state in memory per connection, so a reconnect restarts the hold from
 * zero. Letting the ring quietly reset would read as the app losing count.
 */
export function ConnectionChip({ connection, onRetry }: ConnectionChipProps) {
  if (connection === 'connected' || connection === 'idle') return null;

  if (connection === 'offline') {
    return (
      <div className={styles.chip} data-state="offline">
        <WifiOff size={16} strokeWidth={2.75} aria-hidden="true" />
        <span className={styles.text}>
          <strong>The coach is offline.</strong> Your camera is still running.
        </span>
        <button type="button" className={styles.retry} onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className={styles.chip} data-state="connecting" role="status">
      <Loader size={16} strokeWidth={2.75} className="zf-spin" aria-hidden="true" />
      <span className={styles.text}>
        {connection === 'connecting'
          ? 'Connecting to the coach — up to a minute if it has been idle.'
          : 'Reconnecting. Your hold restarts when it comes back.'}
      </span>
    </div>
  );
}
