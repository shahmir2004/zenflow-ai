import { describe, expect, it } from 'vitest';
import { calculateStreak, utcDay } from '../streak';

const NOW = new Date('2026-09-04T12:00:00Z');
const day = (d: string) => `2026-09-${d}T09:00:00Z`;

describe('calculateStreak', () => {
  it('reports nothing for an empty history', () => {
    expect(calculateStreak([], NOW)).toEqual({
      current: 0,
      longest: 0,
      practisedToday: false,
    });
  });

  it('counts consecutive days ending today', () => {
    const result = calculateStreak([day('02'), day('03'), day('04')], NOW);
    expect(result.current).toBe(3);
    expect(result.practisedToday).toBe(true);
  });

  it('keeps the streak alive when yesterday was the last session', () => {
    // The day is not over. Requiring today would show zero every morning.
    const result = calculateStreak([day('02'), day('03')], NOW);
    expect(result.current).toBe(2);
    expect(result.practisedToday).toBe(false);
  });

  it('breaks the streak once a day is missed', () => {
    const result = calculateStreak([day('01'), day('02')], NOW);
    expect(result.current).toBe(0);
    expect(result.longest).toBe(2);
  });

  it('counts several sessions in one day once', () => {
    const result = calculateStreak(
      ['2026-09-04T07:00:00Z', '2026-09-04T09:00:00Z', '2026-09-04T20:00:00Z'],
      NOW
    );
    expect(result.current).toBe(1);
  });

  it('remembers the longest run even after it is broken', () => {
    const result = calculateStreak(
      [day('01'), day('02'), day('03'), day('04')].concat([
        '2026-08-01T09:00:00Z',
        '2026-08-02T09:00:00Z',
        '2026-08-03T09:00:00Z',
        '2026-08-04T09:00:00Z',
        '2026-08-05T09:00:00Z',
      ]),
      NOW
    );
    expect(result.current).toBe(4);
    expect(result.longest).toBe(5);
  });

  it('does not care what order the timestamps arrive in', () => {
    const forwards = calculateStreak([day('02'), day('03'), day('04')], NOW);
    const backwards = calculateStreak([day('04'), day('02'), day('03')], NOW);
    expect(backwards).toEqual(forwards);
  });

  it('buckets a timestamp to its UTC day', () => {
    expect(utcDay('2026-09-04T23:59:59Z')).toBe('2026-09-04');
    expect(utcDay('2026-09-05T00:00:01Z')).toBe('2026-09-05');
  });
});
