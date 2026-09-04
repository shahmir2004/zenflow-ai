'use client';

import { createBrowserClient } from '@supabase/ssr';
import { isSupabaseConfigured } from './config';

/**
 * Supabase client for the browser.
 *
 * Safe to call repeatedly — createBrowserClient returns the same instance for
 * the same arguments, so components can each grab one without coordinating.
 *
 * The publishable key is public by design. Every table is behind row-level
 * security keyed on auth.uid(), so the key alone grants access to nothing.
 */
export function createClient() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured; check isSupabaseConfigured() first.');
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
