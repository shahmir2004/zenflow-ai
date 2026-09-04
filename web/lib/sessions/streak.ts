/**
 * Streak arithmetic, kept pure so it can be tested without a database.
 *
 * Days are counted in UTC. That is a real simplification: someone practising
 * at 1am local time in a positive-offset zone has it counted as the previous
 * day. Fixing it properly means storing the user's timezone and doing the
 * bucketing in their zone — worth doing if streaks ever become load-bearing,
 * and not worth it while they are a number on a dashboard.
 */

/** YYYY-MM-DD in UTC. */
export function utcDay(value: string | Date): string {
  return new Date(value).toISOString().slice(0, 10);
}

function addDays(day: string, delta: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export interface StreakResult {
  /** Consecutive days ending today or yesterday. */
  current: number;
  /** The longest run ever recorded. */
  longest: number;
  /** True when today already has a session. */
  practisedToday: boolean;
}

/**
 * A streak survives until a day is *missed*, so practising yesterday but not
 * yet today keeps the run alive — the day is not over. Requiring today would
 * show a streak of zero every morning, which is both wrong and discouraging.
 */
export function calculateStreak(
  timestamps: (string | Date)[],
  now: Date = new Date()
): StreakResult {
  if (timestamps.length === 0) {
    return { current: 0, longest: 0, practisedToday: false };
  }

  const days = [...new Set(timestamps.map(utcDay))].sort();
  const today = utcDay(now);
  const yesterday = addDays(today, -1);

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i += 1) {
    if (days[i] === addDays(days[i - 1], 1)) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > longest) longest = run;
  }

  const mostRecent = days[days.length - 1];
  let current = 0;
  if (mostRecent === today || mostRecent === yesterday) {
    current = 1;
    for (let i = days.length - 1; i > 0; i -= 1) {
      if (days[i - 1] === addDays(days[i], -1)) current += 1;
      else break;
    }
  }

  return { current, longest, practisedToday: days.includes(today) };
}
