import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { isSupabaseConfigured } from './config';

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * Must be created per request — it closes over that request's cookies, so a
 * module-level singleton would serve one user's session to everyone.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components cannot set cookies. That is fine: the
            // middleware refreshes the session on every request, so the only
            // thing lost here is a write the middleware has already done.
          }
        },
      },
    }
  );
}

/** The signed-in user, or null. Never throws — callers branch on null. */
export async function getUser() {
  if (!isSupabaseConfigured()) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
