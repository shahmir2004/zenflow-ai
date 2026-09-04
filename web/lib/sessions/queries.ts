import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { calculateStreak, utcDay, type StreakResult } from './streak';

export interface Profile {
  id: string;
  display_name: string | null;
  goal: 'balance' | 'strength' | 'calm' | null;
  experience: 'new' | 'some' | 'regular' | null;
  minutes_available: number | null;
  floor_ok: boolean | null;
  onboarding_completed_at: string | null;
}

export interface PlanRow {
  id: string;
  name: string;
  description: string | null;
  rationale: string | null;
  steps: { pose_id: string; hold_seconds: number; rest_seconds: number }[];
  is_active: boolean;
  created_at: string;
}

export interface SessionRow {
  id: string;
  mode: 'single' | 'flow' | 'plan';
  started_at: string;
  ended_at: string;
  total_held_seconds: number;
  poses_to_target: number;
  total_poses: number;
}

export async function getProfile(): Promise<Profile | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, goal, experience, minutes_available, floor_ok, onboarding_completed_at')
    .eq('id', user.id)
    .maybeSingle();

  return (data as Profile) ?? null;
}

export async function getActivePlan(): Promise<PlanRow | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('plans')
    .select('id, name, description, rationale, steps, is_active, created_at')
    .eq('is_active', true)
    .maybeSingle();
  return (data as PlanRow) ?? null;
}

export async function getRecentSessions(limit = 10): Promise<SessionRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from('sessions')
    .select('id, mode, started_at, ended_at, total_held_seconds, poses_to_target, total_poses')
    .order('ended_at', { ascending: false })
    .limit(limit);
  return (data as SessionRow[]) ?? [];
}

/**
 * Every session date, for the streak.
 *
 * Only the timestamp is selected — the streak needs nothing else, and pulling
 * whole rows to count days would grow with history for no benefit.
 */
export async function getStreak(): Promise<StreakResult> {
  if (!isSupabaseConfigured()) return calculateStreak([]);
  const supabase = await createClient();
  const { data } = await supabase
    .from('sessions')
    .select('ended_at')
    .order('ended_at', { ascending: false })
    .limit(400);

  return calculateStreak((data ?? []).map((row) => row.ended_at as string));
}

export interface CorrectionTrendPoint {
  session_id: string;
  ended_at: string;
  count: number;
}

export interface CorrectionTrend {
  poseId: string;
  correction: string;
  total: number;
  points: CorrectionTrendPoint[];
}

/**
 * How often each correction fired, per session, over time.
 *
 * This is the metric the app exists to show: not how much you practised, but
 * whether your form is improving. Joined through sessions so the ordering is
 * by when the session happened rather than by insertion.
 */
export async function getCorrectionTrends(limitPerPose = 3): Promise<CorrectionTrend[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();

  const { data } = await supabase
    .from('session_corrections')
    .select('pose_id, correction, count, session_id, sessions!inner(ended_at)')
    .order('ended_at', { ascending: true, referencedTable: 'sessions' })
    .limit(1000);

  if (!data) return [];

  const grouped = new Map<string, CorrectionTrend>();

  for (const row of data as unknown as {
    pose_id: string;
    correction: string;
    count: number;
    session_id: string;
    sessions: { ended_at: string } | { ended_at: string }[];
  }[]) {
    const session = Array.isArray(row.sessions) ? row.sessions[0] : row.sessions;
    if (!session) continue;

    const key = `${row.pose_id}::${row.correction}`;
    let entry = grouped.get(key);
    if (!entry) {
      entry = { poseId: row.pose_id, correction: row.correction, total: 0, points: [] };
      grouped.set(key, entry);
    }
    entry.total += row.count;
    entry.points.push({
      session_id: row.session_id,
      ended_at: session.ended_at,
      count: row.count,
    });
  }

  for (const entry of grouped.values()) {
    entry.points.sort((a, b) => a.ended_at.localeCompare(b.ended_at));
  }

  return [...grouped.values()]
    .sort((a, b) => b.total - a.total)
    .slice(0, limitPerPose);
}

/** Longest hold ever recorded, per pose. */
export async function getPersonalBests(): Promise<Record<string, number>> {
  if (!isSupabaseConfigured()) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from('session_poses')
    .select('pose_id, held_seconds')
    .order('held_seconds', { ascending: false })
    .limit(500);

  const best: Record<string, number> = {};
  for (const row of (data ?? []) as { pose_id: string; held_seconds: number }[]) {
    const current = best[row.pose_id] ?? 0;
    if (row.held_seconds > current) best[row.pose_id] = row.held_seconds;
  }
  return best;
}


export interface DayPractice {
  /** YYYY-MM-DD, UTC — the same bucketing the streak uses. */
  day: string;
  sessions: number;
  heldSeconds: number;
}

/**
 * One row per day for the practice calendar.
 *
 * Returns a dense range — every day in the window, including the empty ones —
 * because a calendar has to draw the gaps. Working that out in the component
 * would mean it needed its own idea of what "today" is, and the streak already
 * owns that.
 */
export async function getDailyPractice(days = 84): Promise<DayPractice[]> {
  const since = new Date(Date.now() - (days - 1) * 86_400_000);
  since.setUTCHours(0, 0, 0, 0);

  const byDay = new Map<string, DayPractice>();

  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('sessions')
      .select('ended_at, total_held_seconds')
      .gte('ended_at', since.toISOString())
      .order('ended_at', { ascending: true });

    for (const row of (data ?? []) as { ended_at: string; total_held_seconds: number }[]) {
      const day = utcDay(row.ended_at);
      const entry = byDay.get(day) ?? { day, sessions: 0, heldSeconds: 0 };
      entry.sessions += 1;
      entry.heldSeconds += Number(row.total_held_seconds);
      byDay.set(day, entry);
    }
  }

  const dense: DayPractice[] = [];
  for (let i = 0; i < days; i += 1) {
    const date = new Date(since.getTime() + i * 86_400_000);
    const day = date.toISOString().slice(0, 10);
    dense.push(byDay.get(day) ?? { day, sessions: 0, heldSeconds: 0 });
  }
  return dense;
}
