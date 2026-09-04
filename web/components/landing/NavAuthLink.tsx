'use client';

import Link from 'next/link';
import { useSignedIn } from '@/lib/hooks/useSignedIn';

/**
 * The landing nav's sign-in slot.
 *
 * See lib/hooks/useSignedIn for why this is a cookie sniff and not a real
 * session read: the landing page is statically prerendered, and neither making
 * it dynamic nor shipping the Supabase client to it is worth one word.
 */
export function NavAuthLink({ className }: { className?: string }) {
  const signedIn = useSignedIn();

  return (
    <Link href={signedIn ? '/home' : '/sign-in'} className={className}>
      {signedIn ? 'Your practice' : 'Sign in'}
    </Link>
  );
}
