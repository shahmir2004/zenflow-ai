'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { authCallbackUrl } from '@/lib/siteUrl';
import { isSupabaseConfigured } from '@/lib/supabase/config';

export type AuthResult = { error: string } | { sent: true };

/**
 * Email magic link. No password to choose, forget, or reset.
 *
 * The result is deliberately the same whether or not the address has an
 * account: telling them apart turns this form into a way to check who has
 * signed up.
 */
export async function signInWithEmail(
  _prev: AuthResult | null,
  formData: FormData
): Promise<AuthResult> {
  const email = String(formData.get('email') ?? '').trim();
  const next = String(formData.get('next') ?? '/home');

  if (!isSupabaseConfigured()) {
    return { error: 'Accounts are not set up on this deployment yet.' };
  }
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: 'That does not look like an email address.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: authCallbackUrl(next) },
  });

  if (error) return { error: error.message };
  return { sent: true };
}

/** Google OAuth. Redirects out to Google and returns via /auth/callback. */
export async function signInWithGoogle(formData: FormData) {
  const next = String(formData.get('next') ?? '/home');
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: authCallbackUrl(next) },
  });

  if (error || !data.url) {
    redirect(`/sign-in?error=${encodeURIComponent(error?.message ?? 'google-failed')}`);
  }

  redirect(data.url);
}
