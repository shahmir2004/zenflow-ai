import { getYogaPose } from '@/lib/data/poses';
import type { CorrectionTrend as Trend } from '@/lib/sessions/queries';
import styles from './CorrectionTrend.module.css';

/**
 * How often one correction fired, session by session.
 *
 * Form: small multiples of bars, one row per correction, rather than a single
 * multi-series line. Sessions are discrete occasions at irregular intervals —
 * a line between them would imply a rate of change through time that the data
 * does not describe. Bars say "this many, on that occasion", which is what
 * happened.
 *
 * Colour: one hue per row, because each row is a single series. The most
 * recent session takes the darker step of the same hue — sequential, so it
 * reads as emphasis rather than as a different category. accent-500 was the
 * obvious choice and fails 3:1 against both surfaces, so the ramp starts at
 * 600.
 *
 * Every bar carries its value as text, which is what discharges the contrast
 * obligation on the fills and makes the row readable without colour at all.
 */
export function CorrectionTrend({ trend }: { trend: Trend }) {
  const pose = getYogaPose(trend.poseId);
  const peak = Math.max(...trend.points.map((p) => p.count), 1);

  const first = trend.points[0]?.count ?? 0;
  const latest = trend.points.at(-1)?.count ?? 0;
  const improving = trend.points.length >= 2 && latest < first;
  const worsening = trend.points.length >= 2 && latest > first;

  return (
    <article className={styles.row}>
      <header className={styles.head}>
        <div>
          <h3 className={styles.correction}>{trend.correction}</h3>
          <p className={styles.pose}>
            {pose?.name ?? trend.poseId} · came up {trend.total}×
          </p>
        </div>

        {/* The verdict is a sentence first and a colour second, so it works
            in greyscale and for anyone who cannot separate the two hues. */}
        {improving && (
          <span className={styles.better}>
            Down from {first} to {latest}
          </span>
        )}
        {worsening && (
          <span className={styles.worse}>
            Up from {first} to {latest}
          </span>
        )}
      </header>

      <div className={styles.chart} role="img" aria-label={
        `${trend.correction} in ${pose?.name ?? trend.poseId}: ` +
        trend.points
          .map((p) => `${p.count} on ${new Date(p.ended_at).toLocaleDateString()}`)
          .join(', ')
      }>
        {trend.points.map((point, index) => {
          const isLatest = index === trend.points.length - 1;
          const height = Math.max(6, (point.count / peak) * 100);
          return (
            <div key={point.session_id + index} className={styles.column}>
              <span className={styles.value}>{point.count}</span>
              <div
                className={styles.bar}
                data-latest={isLatest}
                style={{ height: `${height}%` }}
                title={`${point.count} on ${new Date(point.ended_at).toLocaleDateString()}`}
              />
            </div>
          );
        })}
      </div>

      <div className={styles.axis}>
        <span>{new Date(trend.points[0].ended_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
        <span>
          {trend.points.length > 1 &&
            new Date(trend.points.at(-1)!.ended_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
        </span>
      </div>
    </article>
  );
}
