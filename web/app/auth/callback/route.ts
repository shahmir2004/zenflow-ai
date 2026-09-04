import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { siteOrigin } from '@/lib/siteUrl';

/**
 * Where Google OAuth and email magic links land.
 *
 * Exchanges the one-time code for a session cookie, then forwards on. New
 * accounts go to onboarding; returning ones go where they were headed.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  // One trusted origin for every branch. `new URL(request.url).origin`
  // is the internal host behind a proxy, so these error redirects were
  // pointing at a URL that does not resolve publicly.
  const origin = siteOrigin();
  if (!isSupabaseConfigured()) return NextResponse.redirect(`${origin}/`);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/home';

  // Supabase reports a refused or expired link here rather than by failing the
  // exchange, so this has to be read before assuming a code is present.
  const error = searchParams.get('error_description') ?? searchParams.get('error');
  if (error) {
    return NextResponse.redirect(`${origin}/sign-in?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing-code`);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(exchangeError.message)}`
    );
  }

  // Send first-time users to onboarding. The profile row always exists by now
  // (created by the on_auth_user_created trigger), so a missing row means
  // something is wrong rather than "not onboarded" — treat it as onboarded and
  // let /home deal with it, rather than trapping someone in a loop.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let destination = next;
  if (user && next === '/home') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarding_completed_at')
      .eq('id', user.id)
      .maybeSingle();

    if (profile && !profile.onboarding_completed_at) destination = '/onboarding';
  }

  /*
   * Also the trusted origin rather than x-forwarded-host. The session cookie
   * is already set on the real domain by this point, so a forged host here
   * could not steal it — but it could still bounce a freshly signed-in user
   * onto an attacker's page, and there is no reason to derive this from a
   * request when the platform already tells us who we are.
   */
  return NextResponse.redirect(`${siteOrigin()}${destination}`);
}
