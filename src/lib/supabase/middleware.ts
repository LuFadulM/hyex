import { createServerClient } from '@supabase/ssr'
import type { NextRequest, NextResponse } from 'next/server'
import { supabaseEnv } from './env'
import { sharedAccount } from './shared-account'

/**
 * Makes sure the request has a session, creating one if it does not.
 *
 * It writes onto a response the caller already has rather than making its own,
 * so the next-intl middleware can own routing and this can own auth without
 * either discarding the other's cookies or headers.
 *
 * There is no sign-in screen to send anyone to, so a visitor with no session
 * is signed into the one shared account here, in the only place that can
 * actually persist it: a Server Component may read cookies but not set them,
 * so doing this any deeper would re-authenticate on every single request and
 * never remember a thing.
 */
export async function ensureSession(
  request: NextRequest,
  response: NextResponse,
): Promise<{ isSignedIn: boolean; created: boolean }> {
  const { url, anonKey } = supabaseEnv()

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value)
          response.cookies.set(name, value, options)
        }
      },
    },
  })

  // getUser, not getSession: it revalidates the token with Supabase rather than
  // trusting a cookie the browser could have been handed by anyone.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) return { isSignedIn: true, created: false }

  const account = sharedAccount()
  if (!account) return { isSignedIn: false, created: false }

  const { error } = await supabase.auth.signInWithPassword({
    email: account.email,
    password: account.code,
  })
  // A failure here is a broken deployment, not a visitor doing anything wrong
  // — there is nothing they could type differently. The request carries on
  // signed out, and the pages fall back to the page that explains the app.
  //
  // `created` says the session was made during *this* request, which is the
  // one case where it exists only as cookies on the response and has not
  // reached the app yet.
  return { isSignedIn: !error, created: !error }
}
