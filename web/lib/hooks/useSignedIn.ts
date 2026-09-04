'use client';

import { useEffect, useState } from 'react';

/**
 * Whether there is a session, judged from the browser.
 *
 * Deliberately a cookie sniff rather than a Supabase call. This is only ever
 * used to choose where a "back" link points and what one nav label says —
 * never to decide access. Reading the real session would mean either making
 * the page dynamic or pulling the Supabase client into a bundle that has no
 * other use for it, and both cost more than the question is worth.
 *
 * Being wrong is harmless in both directions: /sign-in redirects a signed-in
 * user to /home, and /home redirects a signed-out one to /sign-in. Anything
 * that actually gates on identity calls getUser() on the server.
 */
export function hasAuthCookie(): boolean {
  if (typeof document === 'undefined') return false;
  // Supabase stores its session as `sb-<project-ref>-auth-token`, sometimes
  // split across `.0`, `.1` chunks when it exceeds the per-cookie size limit.
  return document.cookie
    .split(';')
    .some((cookie) => /^\s*sb-.*-auth-token(\.\d+)?=/.test(cookie));
}

export function useSignedIn(): boolean {
  // False on the server and on first paint, which is correct for everyone
  // signed out and settles within a tick for everyone else.
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    setSignedIn(hasAuthCookie());
  }, []);

  return signedIn;
}

/**
 * Where "back" should go from inside the app.
 *
 * A signed-in user finishing a session belongs on their dashboard, not on the
 * marketing page — the landing page is for people who have not decided yet,
 * and sending someone there after they have just practised loses their streak,
 * their plan and their history behind a "Sign in" link.
 */
export function useHomeHref(): string {
  return useSignedIn() ? '/home' : '/';
}

/** The matching label, so the link never says something it does not do. */
export function useHomeLabel(): string {
  return useSignedIn() ? 'Back to your practice' : 'Back to the poses';
}
