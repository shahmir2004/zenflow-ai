'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * The nav's sign-in slot, resolved in the browser.
 *
 * This deliberately does not import the Supabase client. Two earlier attempts
 * were worse: reading the session on the server made the whole landing page
 * dynamic, and importing the browser client added ~70 kB to the one page built
 * to be someone's first impression. Both are a bad trade for a single word.
 *
 * Instead it sniffs for Supabase's auth cookie, which is enough to choose a
 * label and costs nothing. Being wrong is harmless: /sign-in redirects a
 * signed-in user to /home, so the destination is right either way. Pages that
 * actually gate on identity call getUser() properly — this never decides
 * access, only wording.
 */
function hasAuthCookie(): boolean {
  if (typeof document === 'undefined') return false;
  // Supabase stores its session as `sb-<project-ref>-auth-token`, sometimes
  // split across `.0`, `.1` chunks when it exceeds the per-cookie size limit.
  return document.cookie
    .split(';')
    .some((cookie) => /^\s*sb-.*-auth-token(\.\d+)?=/.test(cookie));
}

export function NavAuthLink({ className }: { className?: string }) {
  // "Sign in" on the server and on first paint — correct for everyone signed
  // out, which on this page is nearly everyone.
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setSignedIn(hasAuthCookie());
  }, []);

  return (
    <Link href={signedIn ? '/home' : '/sign-in'} className={className}>
      {signedIn ? 'Your practice' : 'Sign in'}
    </Link>
  );
}
