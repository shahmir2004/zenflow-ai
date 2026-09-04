'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { generatePlans } from './generate';
import type { OnboardingAnswers, PlanCandidate, Shape } from './types';

/**
 * Saves the onboarding answers and the plan chosen from them.
 *
 * The plan is regenerated on the server from the same answers rather than
 * accepted from the client. The generator is pure, so this produces exactly
 * what the user was shown — and it means a hand-crafted request cannot write
 * a plan containing a pose the server does not implement.
 */
export async function completeOnboarding(
  answers: OnboardingAnswers,
  chosenShape: Shape
): Promise<{ ok: boolean; message?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, message: 'Accounts are not configured.' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: 'You need to be signed in to save a plan.' };

  const candidates = generatePlans(answers);
  const chosen = candidates.find((c) => c.shape === chosenShape) ?? candidates[0];
  if (!chosen) return { ok: false, message: 'Could not build a plan from those answers.' };

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      goal: answers.goal,
      experience: answers.experience,
      minutes_available: answers.minutes,
      floor_ok: answers.floorOk,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  if (profileError) return { ok: false, message: profileError.message };

  // Only one plan may be active at a time, enforced by a partial unique index.
  // Clearing first keeps the insert below from colliding with it.
  await supabase.from('plans').update({ is_active: false }).eq('user_id', user.id);

  const { error: planError } = await supabase.from('plans').insert({
    user_id: user.id,
    name: chosen.name,
    description: chosen.description,
    rationale: chosen.rationale,
    steps: chosen.steps.map((s) => ({
      pose_id: s.poseId,
      hold_seconds: s.holdSeconds,
      rest_seconds: s.restSeconds,
    })),
    is_active: true,
  });

  if (planError) return { ok: false, message: planError.message };

  revalidatePath('/home');
  return { ok: true };
}

/** Rebuild plan options from stored answers, for changing plan later. */
export async function replanFromProfile(): Promise<PlanCandidate[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('profiles')
    .select('goal, experience, minutes_available, floor_ok')
    .eq('id', user.id)
    .maybeSingle();

  if (!data?.goal || !data.experience || !data.minutes_available || data.floor_ok === null) {
    return [];
  }

  return generatePlans({
    goal: data.goal,
    experience: data.experience,
    minutes: data.minutes_available as OnboardingAnswers['minutes'],
    floorOk: data.floor_ok,
  });
}

export async function onboardAndRedirect(answers: OnboardingAnswers, shape: Shape) {
  const result = await completeOnboarding(answers, shape);
  if (result.ok) redirect('/home');
  return result;
}
