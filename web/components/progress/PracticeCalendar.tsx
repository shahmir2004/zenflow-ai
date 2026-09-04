import type { DayPractice } from '@/lib/sessions/queries';
import styles from './PracticeCalendar.module.css';

/**
 * Twelve weeks of practice, one cell per day.
 *
 * Form: a calendar heatmap, because the question it answers is "am I turning
 * up?" — a pattern over dates, not a magnitude to compare precisely. A bar
 * chart of the same data would be 84 bars, most of them zero, and would make
 * the gaps harder to see rather than easier.
 *
 * Colour: sequential, one hue, light to dark. Practice is a magnitude, so the
 * ramp runs through a single accent hue; a rest day takes a neutral so it
 * reads as absent rather than as "a little". Nothing here is categorical, so
 * no two steps ever need to be told apart by identity — only by order.
 *
 * Every cell carries its own date and total in a title, and the whole grid is
 * summarised for screen readers, so none of the meaning is colour-only.
 */

/** Thresholds in seconds. Five steps including "none". */
const LEVELS = [0, 1, 120, 360, 720];

function levelFor(heldSeconds: number): number {
  let level = 0;
  for (let i = 1; i < LEVELS.length; i += 1) {
    if (heldSeconds >= LEVELS[i]) level = i;
  }
  return level;
}

function formatHeld(seconds: number): string {
  if (seconds <= 0) return 'no practice';
  const minutes = Math.floor(seconds / 60);
  if (minutes === 0) return `${Math.round(seconds)}s`;
  return `${minutes}m`;
}

const WEEKDAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

export function PracticeCalendar({ days }: { days: DayPractice[] }) {
  if (days.length === 0) return null;

  /*
   * Pad the front so every column is a whole week starting on Monday.
   * Without this the grid shears: the first column starts on whatever weekday
   * the window happens to open on, and the weekday labels stop being true.
   */
  const first = new Date(`${days[0].day}T00:00:00Z`);
  const leading = (first.getUTCDay() + 6) % 7;
  const cells: (DayPractice | null)[] = [...Array(leading).fill(null), ...days];

  const weeks: (DayPractice | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const active = days.filter((d) => d.sessions > 0).length;
  const totalHeld = days.reduce((sum, d) => sum + d.heldSeconds, 0);

  // Month boundaries, so the axis reads as time rather than as 12 anonymous
  // columns. One label per month, at the week it begins.
  const monthLabels = weeks.map((week, index) => {
    const day = week.find(Boolean);
    if (!day) return null;
    const date = new Date(`${day.day}T00:00:00Z`);
    const previous = index > 0 ? weeks[index - 1].find(Boolean) : null;
    const previousMonth = previous
      ? new Date(`${previous.day}T00:00:00Z`).getUTCMonth()
      : -1;
    if (date.getUTCMonth() === previousMonth) return null;
    return date.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' });
  });

  return (
    <section className={styles.wrap}>
      <header className={styles.head}>
        <div>
          <h2 className={styles.title}>Your last twelve weeks</h2>
          <p className={styles.lede}>
            {active === 0
              ? 'Nothing here yet — your first session fills the first square.'
              : `${active} day${active === 1 ? '' : 's'} practised, ${formatHeld(totalHeld)} held in total.`}
          </p>
        </div>
      </header>

      <div className={styles.scroller}>
        <div className={styles.grid}>
          <div className={styles.weekdays} aria-hidden="true">
            {WEEKDAY_LABELS.map((label, i) => (
              <span key={i} className={styles.weekday}>
                {label}
              </span>
            ))}
          </div>

          <div className={styles.weeks}>
            <div className={styles.months} aria-hidden="true">
              {monthLabels.map((label, i) => (
                <span key={i} className={styles.month}>
                  {label}
                </span>
              ))}
            </div>

            <div
              className={styles.cells}
              role="img"
              aria-label={
                active === 0
                  ? 'Practice calendar: no sessions in the last twelve weeks.'
                  : `Practice calendar: ${active} days practised in the last twelve weeks, ${formatHeld(totalHeld)} held in total.`
              }
            >
              {weeks.map((week, wi) => (
                <div key={wi} className={styles.week}>
                  {week.map((day, di) =>
                    day ? (
                      <span
                        key={day.day}
                        className={styles.cell}
                        data-level={levelFor(day.heldSeconds)}
                        title={`${new Date(`${day.day}T00:00:00Z`).toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          timeZone: 'UTC',
                        })} — ${formatHeld(day.heldSeconds)}`}
                      />
                    ) : (
                      <span key={`pad-${wi}-${di}`} className={styles.pad} />
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.legend}>
        <span className={styles.legendLabel}>Less</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span key={level} className={styles.cell} data-level={level} aria-hidden="true" />
        ))}
        <span className={styles.legendLabel}>More</span>
      </div>
    </section>
  );
}
