import type { SessionRow } from '@/lib/sessions/queries';
import styles from './HoldChart.module.css';

/**
 * How long each recent session was held for.
 *
 * Form: bars, one per session. Sessions are discrete occasions at irregular
 * intervals, so a line between them would imply a rate of change through time
 * that the data does not describe.
 *
 * Colour: a single series, so a single hue — and the darker step for the most
 * recent, which is emphasis within the same ramp rather than a second
 * category. accent-500 is the obvious mid step and fails 3:1 against this
 * surface, so the ramp starts at 600.
 *
 * A single series needs no legend; the heading names it. Values are labelled
 * on hover and the whole chart is summarised for screen readers.
 */
function formatHeld(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  if (minutes === 0) return `${rest}s`;
  return `${minutes}m ${String(rest).padStart(2, '0')}s`;
}

export function HoldChart({ sessions }: { sessions: SessionRow[] }) {
  // Oldest first, so the chart reads left to right like everything else.
  const recent = [...sessions].slice(0, 14).reverse();
  if (recent.length < 2) return null;

  const peak = Math.max(...recent.map((s) => Number(s.total_held_seconds)), 1);

  return (
    <section className={styles.wrap}>
      <h2 className={styles.title}>Time held per session</h2>
      <p className={styles.lede}>
        Your last {recent.length} sessions, oldest first.
      </p>

      <div
        className={styles.chart}
        role="img"
        aria-label={`Time held across your last ${recent.length} sessions: ${recent
          .map((s) => formatHeld(Number(s.total_held_seconds)))
          .join(', ')}.`}
      >
        {recent.map((session, index) => {
          const held = Number(session.total_held_seconds);
          const isLatest = index === recent.length - 1;
          return (
            <div key={session.id} className={styles.column}>
              <div
                className={styles.bar}
                data-latest={isLatest}
                style={{ height: `${Math.max(4, (held / peak) * 100)}%` }}
                title={`${new Date(session.ended_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })} — ${formatHeld(held)}, ${session.poses_to_target}/${session.total_poses} to target`}
              />
            </div>
          );
        })}
      </div>

      <div className={styles.axis}>
        <span>
          {new Date(recent[0].ended_at).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
        </span>
        <span className={styles.peak}>peak {formatHeld(peak)}</span>
        <span>
          {new Date(recent[recent.length - 1].ended_at).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
          })}
        </span>
      </div>
    </section>
  );
}
