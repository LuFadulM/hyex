import createIntlMiddleware from 'next-intl/middleware'
import { NextResponse, type NextRequest } from 'next/server'
import { routing } from './i18n/routing'
import { entryHop } from './lib/auth/entry'
import { routeDecision } from './lib/auth/routes'
import { isSupabaseConfigured } from './lib/supabase/env'
import { ensureSession } from './lib/supabase/middleware'

const intlMiddleware = createIntlMiddleware(routing)

/**
 * Marks the one hop taken after signing a visitor in.
 *
 * The session is written as cookies on the response, and cookies only reach
 * the app on the *next* request — so a brand-new visitor is bounced back to
 * the same URL once, arriving with the session in hand. The marker is what
 * makes that a single hop rather than a loop: a browser that refuses the
 * cookies comes back carrying it, and is let through signed out instead of
 * being bounced again forever.
 */
const HOP = 'hx'

export default async function middleware(request: NextRequest) {
  // Locale resolution runs first so that every later decision can be made in
  // the visitor's own language.
  const response = intlMiddleware(request)

  // Without credentials the app still serves its public routes, which is what
  // lets `next build` and CI run with no Supabase project attached.
  if (!isSupabaseConfigured()) return response

  const hopped = request.nextUrl.searchParams.has(HOP)
  const { isSignedIn, created } = await ensureSession(request, response)

  // A session made during this request lives only in the cookies on the way
  // out, so the app would still render this one signed out. `entryHop` decides
  // whether that is worth a bounce, and is where the argument that this cannot
  // loop is written down and tested.
  const hop = entryHop({
    hopped,
    created,
    // next-intl already sending the visitor somewhere carries the cookies for
    // us; bouncing on top of that would only add a request.
    alreadyRedirecting: response.status >= 300 && response.status < 400,
  })

  if (hop !== 'none') {
    const target = request.nextUrl.clone()
    if (hop === 'mark') target.searchParams.set(HOP, '1')
    else target.searchParams.delete(HOP)
    return carryOver(NextResponse.redirect(target), response)
  }

  const decision = routeDecision(request.nextUrl.pathname, isSignedIn)
  if (decision.kind === 'redirect') {
    return carryOver(NextResponse.redirect(new URL(decision.to, request.url)), response)
  }

  return response
}

/**
 * Carries the refreshed session onto a redirect, or the redirected request
 * would arrive signed out and bounce straight back.
 */
function carryOver(redirect: NextResponse, from: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie)
  }
  return redirect
}

export const config = {
  matcher: [
    '/',
    '/(en|es)/:path*',
    // `auth` and `offline` are excluded deliberately: both live outside the
    // [locale] segment. /auth/callback is the fixed URL Supabase redirects to,
    // and /offline is what the service worker serves when the network is gone.
    // Letting the intl middleware prefix either with a locale sends it to a
    // route that does not exist.
    '/((?!api|auth|offline|_next|_vercel|.*\\..*).*)',
  ],
}
