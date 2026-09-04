import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

/**
 * Refreshes the Supabase session on every request.
 *
 * Auth tokens are short-lived. Server Components can read cookies but cannot
 * write them, so without this the token would expire and never renew, and a
 * signed-in user would silently become signed-out on their next navigation.
 *
 * This deliberately does NOT gate any route. ZenFlow is guest-first: the whole
 * live session works signed out, and the landing page promises exactly that
 * ("no account needed for your first flow"). Pages that need a user check for
 * one themselves and offer sign-in; nothing redirects at the edge.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not remove: this call is what performs the refresh. Its result is
  // unused here on purpose.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and the vendored MediaPipe runtime.
     * The wasm bundle and the 5.8 MB pose model are large and immutable —
     * running auth middleware over them would add a round trip to every
     * chunk for no benefit.
     */
    '/((?!_next/static|_next/image|favicon.ico|mediapipe|models|.*\.(?:svg|png|jpg|jpeg|gif|webp|woff2?|task|wasm)$).*)',
  ],
};
