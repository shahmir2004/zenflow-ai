import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Where Google OAuth and email magic links land.
 *
 * Exchanges the one-time code for a session cookie, then forwards on. New
 * accounts go to onboarding; returning ones go where they were headed.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
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
   * Behind a proxy, `origin` is the internal host. Vercel sets
   * x-forwarded-host to the real one, and redirecting to the internal host
   * would drop the user on a URL that does not resolve publicly.
   */
  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocal = process.env.NODE_ENV === 'development';
  const base = isLocal || !forwardedHost ? origin : `https://${forwardedHost}`;

  return NextResponse.redirect(`${base}${destination}`);
}
