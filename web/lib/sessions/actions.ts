'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { isWorthSaving, type SessionRecord } from './types';

export type SaveResult =
  | { status: 'saved'; id: string }
  | { status: 'guest' }
  | { status: 'skipped' }
  | { status: 'error'; message: string };

/** Shape a record for the save_session RPC. */
function rpcArgs(record: SessionRecord) {
  return {
    p_mode: record.mode,
    p_started_at: record.startedAt,
    p_ended_at: record.endedAt,
    p_total_held_seconds: record.totalHeldSeconds,
    p_poses_to_target: record.posesToTarget,
    p_total_poses: record.totalPoses,
    p_plan_id: record.planId,
    p_poses: record.poses.map((p) => ({
      position: p.position,
      pose_id: p.poseId,
      held_seconds: p.heldSeconds,
      target_seconds: p.targetSeconds,
      reached_target: p.reachedTarget,
    })),
    p_corrections: record.corrections.map((c) => ({
      pose_id: c.poseId,
      correction: c.correction,
      count: c.count,
    })),
    p_snapshots: record.snapshots.map((s) => ({
      pose_id: s.poseId,
      correction: s.correction,
      landmarks: s.landmarks,
      joint_colors: s.jointColors,
    })),
  };
}

/**
 * Persist a finished session.
 *
 * Returns `guest` when nobody is signed in — the caller then keeps it in
 * localStorage. This never throws: a failed write must not be allowed to take
 * the summary screen down with it. Losing the record is bad; losing the screen
 * that shows the user what they just did is worse.
 */
export async function saveSession(record: SessionRecord): Promise<SaveResult> {
  if (!isWorthSaving(record)) return { status: 'skipped' };
  // No accounts configured: the session belongs on this device.
  if (!isSupabaseConfigured()) return { status: 'guest' };

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { status: 'guest' };

    const { data, error } = await supabase.rpc('save_session', rpcArgs(record));
    if (error) return { status: 'error', message: error.message };

    revalidatePath('/home');
    revalidatePath('/progress');
    return { status: 'saved', id: data as string };
  } catch (err) {
    return { status: 'error', message: (err as Error).message };
  }
}

/**
 * Claims sessions practised before signing in.
 *
 * Called once, right after the first successful sign-in. Anything invalid is
 * skipped rather than failing the batch — a corrupt localStorage entry should
 * not cost someone the rest of their history.
 */
export async function migrateGuestSessions(
  records: SessionRecord[]
): Promise<{ migrated: number; failed: number }> {
  if (!records.length) return { migrated: 0, failed: 0 };
  if (!isSupabaseConfigured()) return { migrated: 0, failed: records.length };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { migrated: 0, failed: records.length };

  let migrated = 0;
  let failed = 0;

  for (const record of records) {
    if (!isWorthSaving(record)) {
      failed += 1;
      continue;
    }
    // Guest records never carry a plan id — plans require an account.
    const { error } = await supabase.rpc('save_session', {
      ...rpcArgs(record),
      p_plan_id: null,
    });
    if (error) failed += 1;
    else migrated += 1;
  }

  revalidatePath('/home');
  revalidatePath('/progress');
  return { migrated, failed };
}

/** Erase everything practised, keeping the account. Promised in the FAQ. */
export async function deleteAllPracticeData(): Promise<{ ok: boolean; message?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, message: 'Accounts are not configured.' };
  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_my_practice_data');
  if (error) return { ok: false, message: error.message };

  revalidatePath('/home');
  revalidatePath('/progress');
  return { ok: true };
}
