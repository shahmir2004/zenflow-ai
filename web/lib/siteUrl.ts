/**
 * This deployment's own public origin.
 *
 * Never derived from request headers. An earlier version read
 * `x-forwarded-host`, which a client can forge: the forged value went into
 * `emailRedirectTo`, so an attacker could make Supabase email *the victim* a
 * sign-in link pointing at the attacker's host and collect the auth code when
 * they clicked it.
 *
 * Two things happened to blunt that in practice — Vercel normally overwrites
 * the forwarded headers, and Supabase refuses a redirect URL that is not in
 * the project's allow-list — but neither belongs in the threat model. The
 * first is a property of one host, and the second is the very setting that was
 * misconfigured when this was written.
 *
 * Everything below is either set by the platform or by us, and none of it is
 * reachable from a request.
 */
export function siteOrigin(): string {
  // An explicit override always wins: a custom domain, or a preview that
  // should send its links somewhere specific.
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, '');

  // Vercel injects both of these at build and run time.
  if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  // Preview deployments: come back to the preview that sent you, not to
  // production, or a preview's sign-in silently tests the wrong build.
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return `http://localhost:${process.env.PORT ?? 3000}`;
}

/** Where OAuth and magic links return to. */
export function authCallbackUrl(next: string): string {
  return `${siteOrigin()}/auth/callback?next=${encodeURIComponent(next)}`;
}
