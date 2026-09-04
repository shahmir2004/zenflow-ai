'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';

/**
 * Where OAuth and magic links should come back to, in any environment.
 *
 * Derived from the request rather than configured, so it is correct on
 * localhost, on a Vercel preview, and in production without three values to
 * keep in sync. There is deliberately no hardcoded localhost fallback: that is
 * precisely the kind of default that ships to production and mails people a
 * link to a machine that is not theirs.
 *
 * NOTE: Supabase only honours this if the URL matches the project's redirect
 * allow-list. Otherwise it silently substitutes the Site URL, which is why the
 * middleware also rescues a code that arrives on the wrong path.
 */
async function callbackUrl(next: string) {
  const headerList = await headers();

  const forwardedHost = headerList.get('x-forwarded-host');
  const forwardedProto = headerList.get('x-forwarded-proto') ?? 'https';
  const host = headerList.get('host');

  const origin =
    (forwardedHost && `${forwardedProto}://${forwardedHost}`) ??
    headerList.get('origin') ??
    (host && `${host.startsWith('localhost') ? 'http' : 'https'}://${host}`);

  if (!origin) {
    throw new Error("Could not determine this deployment's origin for the auth callback.");
  }

  return `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
}

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
    options: { emailRedirectTo: await callbackUrl(next) },
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
    options: { redirectTo: await callbackUrl(next) },
  });

  if (error || !data.url) {
    redirect(`/sign-in?error=${encodeURIComponent(error?.message ?? 'google-failed')}`);
  }

  redirect(data.url);
}
